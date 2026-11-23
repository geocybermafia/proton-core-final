import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isProjectAssetLinkedTask,
  isValidOrderStatusTransition,
  resolveOrganizerOrderToggleAction,
  shouldGenerateOrganizerFulfillmentTask
} from '../src/lib/marketOrderRules';

// 1. Canonical SellerContext validation logic
const isValidStatusTransition = (
  currentStatus: string,
  newStatus: string,
  isSeller: boolean,
  isBuyer: boolean,
  orderType?: string
): boolean => isValidOrderStatusTransition(currentStatus, newStatus, isSeller, isBuyer, orderType);

// 2. Replicate exact Firestore rules logic for order update
function simulateFirestoreOrderUpdateRule(params: {
  existingOrder: {
    buyerId: string;
    sellerId: string;
    status: string;
    amount: number;
    currency: string;
    listingId: string;
    itemTitle: string;
    createdAt: number;
  };
  incomingData: {
    status?: string;
    [key: string]: any;
  };
  authUid: string;
  isVerified: boolean;
}): { allowed: boolean; reason?: string } {
  const { existingOrder, incomingData, authUid, isVerified } = params;

  if (!isVerified) return { allowed: false, reason: 'User is not verified' };
  if (existingOrder.buyerId !== authUid && existingOrder.sellerId !== authUid) {
    return { allowed: false, reason: 'PERMISSION_DENIED: caller is neither buyer nor seller' };
  }

  const incomingOrder = { ...existingOrder, ...incomingData };

  // Immutability checks
  if (incomingOrder.buyerId !== existingOrder.buyerId) return { allowed: false, reason: 'buyerId immutable' };
  if (incomingOrder.sellerId !== existingOrder.sellerId) return { allowed: false, reason: 'sellerId immutable' };
  if (incomingOrder.listingId !== existingOrder.listingId) return { allowed: false, reason: 'listingId immutable' };
  if (incomingOrder.amount !== existingOrder.amount) return { allowed: false, reason: 'amount immutable' };
  if (incomingOrder.currency !== existingOrder.currency) return { allowed: false, reason: 'currency immutable' };
  if (incomingOrder.itemTitle !== existingOrder.itemTitle) return { allowed: false, reason: 'itemTitle immutable' };
  if (incomingOrder.createdAt !== existingOrder.createdAt) return { allowed: false, reason: 'createdAt immutable' };

  // Affected keys
  const affectedKeys = Object.keys(incomingData);
  const onlyStatus = affectedKeys.length === 1 && affectedKeys[0] === 'status';

  // Seller checks
  if (existingOrder.sellerId === authUid) {
    if (existingOrder.status === 'pending' && incomingOrder.status === 'processing' && onlyStatus) {
      return { allowed: true };
    }
    if (existingOrder.status === 'processing' && incomingOrder.status === 'shipped' && onlyStatus) {
      return { allowed: true };
    }
    if (existingOrder.status === 'booked' && incomingOrder.status === 'in_progress' && onlyStatus) {
      return { allowed: true };
    }
    if (existingOrder.status === 'in_progress' && incomingOrder.status === 'completed' && onlyStatus) {
      return { allowed: true };
    }
    if (['pending', 'booked'].includes(existingOrder.status) && ['cancelled', 'refunded'].includes(incomingOrder.status) && onlyStatus) {
      return { allowed: true };
    }
    return { 
      allowed: false, 
      reason: `PERMISSION_DENIED: Seller cannot transition order from '${existingOrder.status}' to '${incomingOrder.status}'` 
    };
  }

  // Buyer checks
  if (existingOrder.buyerId === authUid) {
    if (existingOrder.status === 'shipped' && incomingOrder.status === 'completed' && onlyStatus) {
      return { allowed: true };
    }
    if (['pending', 'booked'].includes(existingOrder.status) && incomingOrder.status === 'cancelled' && onlyStatus) {
      return { allowed: true };
    }
    return { 
      allowed: false, 
      reason: `PERMISSION_DENIED: Buyer cannot transition order from '${existingOrder.status}' to '${incomingOrder.status}'` 
    };
  }

  return { allowed: false, reason: 'PERMISSION_DENIED' };
}

// 3. Harness to simulate App state and handleToggleTask
class TestAppEnvironment {
  tasks: Array<{ id: string; completed: boolean; orderId?: string; content: string }> = [];
  sellerOrders: Array<{ id: string; orderType: string; status: string; sellerId: string; buyerId: string }> = [];
  toasts: Array<{ message: string; type: string }> = [];
  consoleErrors: any[] = [];
  unhandledRejections: any[] = [];
  networkFails = false;

  constructor() {
    process.on('unhandledRejection', (reason) => {
      this.unhandledRejections.push(reason);
    });
  }

  showToast(message: string, type: string) {
    this.toasts.push({ message, type });
  }

  async updateOrderStatus(orderId: string, nextStatus: string, sellerUid: string) {
    const order = this.sellerOrders.find(o => o.id === orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);

    if (this.networkFails) {
      throw new Error('Firestore connection unavailable (Network Error)');
    }

    const isSeller = sellerUid === order.sellerId;
    const isBuyer = sellerUid === order.buyerId;

    if (!isValidStatusTransition(order.status, nextStatus, isSeller, isBuyer, order.orderType)) {
      throw new Error(`Invalid status transition from '${order.status}' to '${nextStatus}' for role ${isSeller ? 'seller' : 'buyer'}`);
    }

    // Simulate Firestore security rule evaluation
    const ruleResult = simulateFirestoreOrderUpdateRule({
      existingOrder: {
        buyerId: order.buyerId,
        sellerId: order.sellerId,
        status: order.status,
        amount: 150,
        currency: 'USD',
        listingId: 'lst-1',
        itemTitle: 'Item',
        createdAt: 100000
      },
      incomingData: { status: nextStatus },
      authUid: sellerUid,
      isVerified: true
    });

    if (!ruleResult.allowed) {
      throw new Error(ruleResult.reason);
    }

    // Mutate state on success
    order.status = nextStatus;
  }

  async handleToggleTask(id: string, userUid: string) {
    const targetTask = this.tasks.find(t => t.id === id);
    if (!targetTask) return;

    const nextCompleted = !targetTask.completed;
    const targetOrderId = targetTask.orderId;
    const linkedOrder = targetOrderId ? this.sellerOrders.find(o => o.id === targetOrderId) : undefined;

    const toggleAction = resolveOrganizerOrderToggleAction(linkedOrder, nextCompleted);
    if (toggleAction.kind === 'blocked_project_asset') {
      this.showToast('Digital asset orders must be managed from Market Hub or Seller Cabinet.', 'warning');
      return;
    }

    const targetOrderStatus = toggleAction.kind === 'advance_order' ? toggleAction.targetOrderStatus : null;

    if (targetOrderStatus && targetOrderId) {
      const originalCompleted = targetTask.completed;
      // Optimistic update
      targetTask.completed = true;

      try {
        await this.updateOrderStatus(targetOrderId, targetOrderStatus, userUid);
        const shortId = targetOrderId.slice(-6);
        if (targetOrderStatus === 'processing') {
          this.showToast(`შეკვეთა #${shortId} გადავიდა დამუშავებაში`, 'success');
        } else if (targetOrderStatus === 'shipped') {
          this.showToast(`შეკვეთა #${shortId} მონიშნულია როგორც გაგზავნილი`, 'success');
        } else if (targetOrderStatus === 'in_progress') {
          this.showToast(`სერვისის შეკვეთა #${shortId} გადავიდა შესრულებაში`, 'success');
        } else if (targetOrderStatus === 'completed') {
          this.showToast(`სერვისის შეკვეთა #${shortId} დასრულებულია`, 'success');
        }
      } catch (err: any) {
        this.consoleErrors.push(err);
        // Roll back task state
        targetTask.completed = originalCompleted;
        this.showToast(err instanceof Error ? err.message : 'Failed to update linked order status', 'error');
      }
    } else if (targetOrderId && !nextCompleted) {
      targetTask.completed = false;
      if (linkedOrder && linkedOrder.status !== 'pending' && linkedOrder.status !== 'booked') {
        const shortId = targetOrderId.slice(-6);
        this.showToast(`შეკვეთის #${shortId} სტატუსი დარჩა უცვლელი (${linkedOrder.status})`, 'info');
      }
    } else {
      targetTask.completed = nextCompleted;
    }
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('PROTON ORDER SYNC VERIFICATION RUNNER');
  console.log('================================================================\n');

  const sellerUid = 'seller_usr_42';
  const buyerUid = 'buyer_usr_99';

  // -------------------------------------------------------------
  // TEST CASE 1: Physical Product Order Toggle
  // -------------------------------------------------------------
  console.log('--- TEST CASE 1: PHYSICAL PRODUCT ORDER TASK TOGGLE ---');
  const env1 = new TestAppEnvironment();
  env1.sellerOrders = [
    {
      id: 'ord-physical-101',
      orderType: 'product',
      status: 'pending',
      sellerId: sellerUid,
      buyerId: buyerUid
    }
  ];
  env1.tasks = [
    {
      id: 'order-task-ord-physical-101',
      orderId: 'ord-physical-101',
      content: 'Fulfill Physical Order #cal-101',
      completed: false
    }
  ];

  console.log(`[Initial State] Order status: '${env1.sellerOrders[0].status}', Task completed: ${env1.tasks[0].completed}`);
  
  // Action: Toggle task
  await env1.handleToggleTask('order-task-ord-physical-101', sellerUid);

  console.log(`[After Toggle] Order status: '${env1.sellerOrders[0].status}', Task completed: ${env1.tasks[0].completed}`);
  console.log(`[Console Errors count]: ${env1.consoleErrors.length}`);
  console.log(`[Unhandled Rejections count]: ${env1.unhandledRejections.length}`);
  console.log(`[Toasts]:`, env1.toasts);

  assert.equal(env1.sellerOrders[0].status, 'processing', 'Order status MUST advance from pending to processing (NOT completed)');
  assert.equal(env1.tasks[0].completed, true, 'Task completed must be true');
  assert.equal(env1.consoleErrors.length, 0, 'No errors should occur');
  assert.equal(env1.unhandledRejections.length, 0, 'Zero unhandled promise rejections');
  assert.equal(env1.toasts[0].type, 'success');
  console.log('✔ TEST CASE 1 PASSED: Physical product order correctly moved to "processing", no unhandled rejections!\n');

  // Verify second step: processing -> shipped
  console.log('--- TEST CASE 1 (Part B): PROCESSING -> SHIPPED DISPATCH STEP ---');
  env1.tasks[0].completed = false; // Re-open or dispatch step
  await env1.handleToggleTask('order-task-ord-physical-101', sellerUid);
  console.log(`[After Second Toggle] Order status: '${env1.sellerOrders[0].status}', Task completed: ${env1.tasks[0].completed}`);
  assert.equal(env1.sellerOrders[0].status, 'shipped', 'Order status MUST advance from processing to shipped');
  console.log('✔ TEST CASE 1 (Part B) PASSED: Order moved from processing to shipped!\n');

  // -------------------------------------------------------------
  // TEST CASE 2: Rollback Mechanism on Failure
  // -------------------------------------------------------------
  console.log('--- TEST CASE 2: ROLLBACK MECHANISM TEST ---');
  const env2 = new TestAppEnvironment();
  env2.sellerOrders = [
    {
      id: 'ord-physical-202',
      orderType: 'product',
      status: 'pending',
      sellerId: sellerUid,
      buyerId: buyerUid
    }
  ];
  env2.tasks = [
    {
      id: 'order-task-ord-physical-202',
      orderId: 'ord-physical-202',
      content: 'Fulfill Order #202',
      completed: false
    }
  ];

  // Artificially trigger network/firestore failure
  env2.networkFails = true;
  console.log(`[Initial State] Order status: '${env2.sellerOrders[0].status}', Task completed: ${env2.tasks[0].completed}`);
  console.log(`[Injecting Failure] Simulating Firestore Network Connection Drop...`);

  await env2.handleToggleTask('order-task-ord-physical-202', sellerUid);

  console.log(`[After Failed Toggle] Order status: '${env2.sellerOrders[0].status}', Task completed: ${env2.tasks[0].completed}`);
  console.log(`[Caught Console Errors]:`, env2.consoleErrors.map(e => e.message));
  console.log(`[Unhandled Rejections count]: ${env2.unhandledRejections.length}`);
  console.log(`[Toasts]:`, env2.toasts);

  assert.equal(env2.tasks[0].completed, false, 'Task state MUST ROLL BACK to false upon failure');
  assert.equal(env2.sellerOrders[0].status, 'pending', 'Order status MUST remain unchanged at pending');
  assert.equal(env2.unhandledRejections.length, 0, 'Error was caught cleanly; 0 unhandled rejections');
  assert.equal(env2.toasts.length, 1);
  assert.equal(env2.toasts[0].type, 'error');
  assert.ok(env2.toasts[0].message.includes('Network Error'), 'Toast accurately reflects failure');
  console.log('✔ TEST CASE 2 PASSED: Automatic rollback verified and error toast presented to seller!\n');

  // -------------------------------------------------------------
  // TEST CASE 3: Service Order Lifecycle: booked -> in_progress -> completed
  // -------------------------------------------------------------
  console.log('--- TEST CASE 3: SERVICE ORDER LIFECYCLE (booked -> in_progress -> completed) ---');
  const env3 = new TestAppEnvironment();
  env3.sellerOrders = [
    {
      id: 'ord-service-303',
      orderType: 'service',
      status: 'booked',
      sellerId: sellerUid,
      buyerId: buyerUid
    }
  ];
  env3.tasks = [
    {
      id: 'order-task-ord-service-303',
      orderId: 'ord-service-303',
      content: 'Execute Consultation Service #303',
      completed: false
    }
  ];

  console.log(`[Step 0 Initial] Service Order status: '${env3.sellerOrders[0].status}', Task completed: ${env3.tasks[0].completed}`);

  // Step 1: booked -> in_progress
  await env3.handleToggleTask('order-task-ord-service-303', sellerUid);
  console.log(`[Step 1 After Toggle 1] Service Order status: '${env3.sellerOrders[0].status}', Task completed: ${env3.tasks[0].completed}`);
  console.log(`[Toast Step 1]:`, env3.toasts[env3.toasts.length - 1]);
  assert.equal(env3.sellerOrders[0].status, 'in_progress', 'Service status must transition booked -> in_progress');
  assert.equal(env3.tasks[0].completed, true);
  assert.equal(env3.toasts[0].type, 'success');

  // Seller continues service workflow and toggles to complete service
  env3.tasks[0].completed = false; // simulates working on next milestone
  // Step 2: in_progress -> completed
  await env3.handleToggleTask('order-task-ord-service-303', sellerUid);
  console.log(`[Step 2 After Toggle 2] Service Order status: '${env3.sellerOrders[0].status}', Task completed: ${env3.tasks[0].completed}`);
  console.log(`[Toast Step 2]:`, env3.toasts[env3.toasts.length - 1]);
  assert.equal(env3.sellerOrders[0].status, 'completed', 'Service status must transition in_progress -> completed');
  assert.equal(env3.tasks[0].completed, true);
  assert.equal(env3.toasts[1].type, 'success');

  console.log('✔ TEST CASE 3 PASSED: Service order strictly followed booked -> in_progress -> completed!\n');

  // -------------------------------------------------------------
  // TEST CASE 4: Digital Asset (project) Order Isolation in Organizer
  // -------------------------------------------------------------
  console.log('--- TEST CASE 4: DIGITAL ASSET (project) ORDER ISOLATION IN ORGANIZER ---');
  assert.equal(shouldGenerateOrganizerFulfillmentTask({ orderType: 'project', status: 'pending' }), false);
  assert.equal(shouldGenerateOrganizerFulfillmentTask({ orderType: 'project', status: 'booked' }), false);
  assert.equal(shouldGenerateOrganizerFulfillmentTask({ orderType: 'service', status: 'booked' }), true);
  assert.equal(shouldGenerateOrganizerFulfillmentTask({ orderType: 'product', status: 'pending' }), true);

  const env4 = new TestAppEnvironment();
  env4.sellerOrders = [
    {
      id: 'ord-project-404',
      orderType: 'project',
      status: 'pending',
      sellerId: sellerUid,
      buyerId: buyerUid
    },
    {
      id: 'ord-project-legacy-405',
      orderType: 'project',
      status: 'booked',
      sellerId: sellerUid,
      buyerId: buyerUid
    }
  ];
  env4.tasks = [
    {
      id: 'order-task-ord-project-404',
      orderId: 'ord-project-404',
      content: 'Legacy Task for Digital Asset',
      completed: false
    },
    {
      id: 'order-task-ord-project-legacy-405',
      orderId: 'ord-project-legacy-405',
      content: 'Legacy Booked Digital Asset Task',
      completed: false
    }
  ];

  // Legacy tasks for project orders must be filtered out from Organizer view
  const visibleTasks = env4.tasks.filter(t => !isProjectAssetLinkedTask(t, env4.sellerOrders));
  assert.equal(visibleTasks.length, 0, 'Project order tasks must be hidden from Organizer');

  // Direct handleToggleTask invocation on legacy tasks must block status transition
  await env4.handleToggleTask('order-task-ord-project-404', sellerUid);
  await env4.handleToggleTask('order-task-ord-project-legacy-405', sellerUid);
  assert.equal(env4.sellerOrders[0].status, 'pending');
  assert.equal(env4.sellerOrders[1].status, 'booked');
  assert.equal(env4.tasks[0].completed, false);
  assert.equal(env4.tasks[1].completed, false);
  assert.equal(env4.toasts.filter(t => t.type === 'warning').length, 2);
  console.log('✔ TEST CASE 4 PASSED: Project orders never generate Organizer tasks and cannot transition via handleToggleTask!\n');

  console.log('================================================================');
  console.log('ALL TEST CASES VERIFIED AND PASSED WITH 100% COMPLIANCE');
  console.log('================================================================');
}

runTests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});

import React, { useEffect, useRef } from 'react';
import { Workflow } from '../types';
import { useSeller, useSellerStats } from '../contexts/SellerContext';
import { useToast } from './Toast';
import { useLanguage } from '../contexts/LanguageContext';

interface AutomationEngineProps {
  workflows: Workflow[];
}

/**
 * Headless Application-Wide Infrastructure Component: AutomationEngine
 * 
 * Runs continuously at the application root level (independent of current active view/route).
 * Listens to SellerContext events (orders received, orders completed, low stock items)
 * and dispatches matching active automated workflow triggers seamlessly across the entire app.
 */
export const AutomationEngine: React.FC<AutomationEngineProps> = ({ workflows }) => {
  const { sellerOrders } = useSeller();
  const sellerStats = useSellerStats();
  const lowStockItems = sellerStats.lowStockItems;
  const { showToast } = useToast();
  const { language } = useLanguage();

  // Processed event refs to guarantee idempotency and prevent execution loops
  const processedNewOrdersRef = useRef<Set<string>>(new Set());
  const processedCompletedOrdersRef = useRef<Set<string>>(new Set());
  const processedLowStockRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // 1. Process Inbound New Orders Trigger (onOrderReceived)
    sellerOrders.forEach((order) => {
      if (!processedNewOrdersRef.current.has(order.id)) {
        processedNewOrdersRef.current.add(order.id);

        const matchingWfs = workflows.filter(wf => 
          wf.status !== 'inactive' && (
            wf.trigger === 'onOrderReceived' ||
            (wf.trigger && wf.trigger.toLowerCase().includes('order received')) ||
            (wf.trigger && wf.trigger.toLowerCase().includes('new order')) ||
            wf.nodes?.some((n: any) => n.subtype === 'onOrderReceived')
          )
        );

        matchingWfs.forEach((wf) => {
          setTimeout(() => {
            showToast(
              language === 'ka'
                ? `⚡ [ავტომატიზაცია]: ${wf.name} გააქტიურდა შეკვეთაზე #${order.id.slice(-6)} ($${order.amount})`
                : `⚡ [Workflow Triggered]: ${wf.name} for Order #${order.id.slice(-6)} ($${order.amount})`,
              'info'
            );
          }, 150);
        });
      }

      // 2. Process Completed Orders Trigger (onOrderCompleted)
      if (
        (order.status === 'completed' || order.status === 'delivered' || order.status === 'shipped') && 
        !processedCompletedOrdersRef.current.has(order.id)
      ) {
        processedCompletedOrdersRef.current.add(order.id);

        const matchingWfs = workflows.filter(wf => 
          wf.status !== 'inactive' && (
            wf.trigger === 'onOrderCompleted' ||
            (wf.trigger && wf.trigger.toLowerCase().includes('order completed')) ||
            (wf.trigger && wf.trigger.toLowerCase().includes('post-sale')) ||
            wf.nodes?.some((n: any) => n.subtype === 'onOrderCompleted')
          )
        );

        matchingWfs.forEach((wf) => {
          setTimeout(() => {
            showToast(
              language === 'ka'
                ? `⚡ [ავტომატიზაცია]: ${wf.name} გააქტიურდა შეკვეთის დასრულებაზე`
                : `⚡ [Workflow Triggered]: ${wf.name} for Completed Order #${order.id.slice(-6)}`,
              'success'
            );
          }, 300);
        });
      }
    });

    // 3. Process Low Stock Alerts Trigger (onLowStock)
    lowStockItems.forEach((item) => {
      if (!processedLowStockRef.current.has(item.id)) {
        processedLowStockRef.current.add(item.id);

        const matchingWfs = workflows.filter(wf => 
          wf.status !== 'inactive' && (
            wf.trigger === 'onLowStock' ||
            (wf.trigger && wf.trigger.toLowerCase().includes('low stock')) ||
            (wf.trigger && wf.trigger.toLowerCase().includes('inventory warning')) ||
            wf.nodes?.some((n: any) => n.subtype === 'onLowStock')
          )
        );

        matchingWfs.forEach((wf) => {
          setTimeout(() => {
            showToast(
              language === 'ka'
                ? `⚠️ [ავტომატიზაცია]: ${wf.name} - დაბალი მარაგი: ${item.title} (${item.quantity} დარჩა)`
                : `⚠️ [Workflow Triggered]: ${wf.name} - Low Stock Warning: ${item.title} (${item.quantity} left)`,
              'warning'
            );
          }, 450);
        });
      }
    });
  }, [sellerOrders, lowStockItems, workflows, showToast, language]);

  return null; // Headless component
};

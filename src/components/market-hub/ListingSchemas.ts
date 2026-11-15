import { Listing } from '../../types';
import { ListingType, inferListingType } from './MarketConstants';

export type DynamicFieldType = 'text' | 'number' | 'select' | 'boolean' | 'url';
export type LocationMode = 'physical' | 'flexible' | 'remote';

export interface DynamicFieldOption {
  value: string;
  labelKa: string;
  labelEn: string;
}

export interface DynamicFieldSchema {
  key: string;
  type: DynamicFieldType;
  labelKa: string;
  labelEn: string;
  placeholderKa?: string;
  placeholderEn?: string;
  required?: boolean;
  options?: readonly DynamicFieldOption[];
  suffix?: string;
  min?: number;
  max?: number;
  maxLength?: number;
  showOnCard?: boolean;
}

export interface CategoryFormSchema {
  categoryId: string;
  listingType: ListingType;
  locationMode: LocationMode;
  showCondition: boolean;
  showServiceTerms: boolean;
  titleLabelKa: string;
  titleLabelEn: string;
  titlePlaceholderKa: string;
  titlePlaceholderEn: string;
  priceLabelKa: string;
  priceLabelEn: string;
  descriptionLabelKa: string;
  descriptionLabelEn: string;
  descriptionPlaceholderKa: string;
  descriptionPlaceholderEn: string;
  fields: readonly DynamicFieldSchema[];
}

export interface FormattedListingAttribute {
  key: string;
  label: string;
  value: string;
  type: DynamicFieldType;
  isSafeUrl: boolean;
}

export interface AttributeValidationResult {
  valid: boolean;
  errors: Record<string, string>;
  firstErrorMessage?: string;
}

export const isSafeExternalUrl = (raw?: unknown): boolean => {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 500) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const COMMON_PRODUCT_BASE: Omit<CategoryFormSchema, 'categoryId' | 'fields'> = {
  listingType: 'product',
  locationMode: 'physical',
  showCondition: true,
  showServiceTerms: false,
  titleLabelKa: 'განცხადების სათაური',
  titleLabelEn: 'Listing Title',
  titlePlaceholderKa: 'მაგ: პროდუქტის ზუსტი დასახელება',
  titlePlaceholderEn: 'e.g. Exact product title',
  priceLabelKa: 'ფასი',
  priceLabelEn: 'Price',
  descriptionLabelKa: 'განცხადების აღწერა',
  descriptionLabelEn: 'Listing Description',
  descriptionPlaceholderKa: 'აღწერეთ პროდუქტის მდგომარეობა, მახასიათებლები და კომპლექტაცია...',
  descriptionPlaceholderEn: 'Describe the product condition, specifications, and included items...',
};

const COMMON_SERVICE_BASE: Omit<CategoryFormSchema, 'categoryId' | 'fields' | 'locationMode'> = {
  listingType: 'service',
  showCondition: false,
  showServiceTerms: true,
  titleLabelKa: 'მომსახურების დასახელება',
  titleLabelEn: 'Service Title',
  titlePlaceholderKa: 'მაგ: ვებსაიტის შექმნა ან ტექნიკის შეკეთება',
  titlePlaceholderEn: 'e.g. Web Development or Repair Service',
  priceLabelKa: 'მომსახურების ფასი',
  priceLabelEn: 'Service Price',
  descriptionLabelKa: 'განცხადების აღწერა',
  descriptionLabelEn: 'Listing Description',
  descriptionPlaceholderKa: 'აღწერეთ რას მოიცავს მომსახურება, გამოცდილება და შესრულების დეტალები...',
  descriptionPlaceholderEn: 'Describe what the service includes, your experience, and delivery details...',
};

const COMMON_PROJECT_BASE: Omit<CategoryFormSchema, 'categoryId' | 'fields' | 'locationMode'> = {
  listingType: 'project',
  showCondition: false,
  showServiceTerms: false,
  titleLabelKa: 'განცხადების სათაური',
  titleLabelEn: 'Listing Title',
  titlePlaceholderKa: 'მაგ: პროექტის ან პოზიციის დასახელება',
  titlePlaceholderEn: 'e.g. Project or position title',
  priceLabelKa: 'ბიუჯეტი / ფასი',
  priceLabelEn: 'Budget / Price',
  descriptionLabelKa: 'განცხადების აღწერა',
  descriptionLabelEn: 'Listing Description',
  descriptionPlaceholderKa: 'აღწერეთ პროექტის დეტალები, მიზნები და ძირითადი პირობები...',
  descriptionPlaceholderEn: 'Describe the project details, goals, and key terms...',
};

const CATEGORY_SCHEMAS: Record<string, CategoryFormSchema> = {
  // =========================================================
  // PROJECT (6 active categories)
  // =========================================================
  'youtube-channels': {
    ...COMMON_PROJECT_BASE,
    categoryId: 'youtube-channels',
    locationMode: 'remote',
    titleLabelKa: 'არხის სახელი',
    titleLabelEn: 'Channel Name',
    titlePlaceholderKa: 'მაგ: Tech & AI YouTube არხი (120K გამომწერი)',
    titlePlaceholderEn: 'e.g. Tech & AI YouTube Channel (120K Subs)',
    priceLabelKa: 'არხის ფასი',
    priceLabelEn: 'Channel Price',
    descriptionPlaceholderKa: 'აღწერეთ არხის თემატიკა, აუდიტორიის გეოგრაფია, შემოსავლის წყაროები და გადაცემის პირობები...',
    descriptionPlaceholderEn: 'Describe channel niche, audience geography, revenue streams, and transfer process...',
    fields: [
      {
        key: 'channelNiche',
        type: 'text',
        labelKa: 'არხის თემატიკა (ნიშა)',
        labelEn: 'Channel Niche',
        placeholderKa: 'მაგ: ტექნოლოგიები, განათლება, გართობა',
        placeholderEn: 'e.g. Tech, Education, Gaming',
        required: true,
        maxLength: 80,
        showOnCard: true,
      },
      {
        key: 'subscribersCount',
        type: 'number',
        labelKa: 'გამომწერების რაოდენობა',
        labelEn: 'Subscribers Count',
        placeholderKa: 'მაგ: 50000',
        placeholderEn: 'e.g. 50000',
        required: true,
        min: 0,
        max: 500000000,
        showOnCard: true,
      },
      {
        key: 'monetizationStatus',
        type: 'select',
        labelKa: 'მონეტიზაციის სტატუსი',
        labelEn: 'Monetization Status',
        required: true,
        showOnCard: true,
        options: [
          { value: 'monetized', labelKa: 'მონეტიზებული (ჩართულია)', labelEn: 'Monetized (Active)' },
          { value: 'eligible', labelKa: 'აკმაყოფილებს მოთხოვნებს', labelEn: 'Eligible to Apply' },
          { value: 'not_monetized', labelKa: 'არ არის მონეტიზებული', labelEn: 'Not Monetized' },
        ],
      },
      {
        key: 'monthlyViews',
        type: 'number',
        labelKa: 'საშუალო თვიური ნახვები',
        labelEn: 'Average Monthly Views',
        placeholderKa: 'მაგ: 250000',
        placeholderEn: 'e.g. 250000',
        min: 0,
      },
      {
        key: 'monthlyRevenue',
        type: 'number',
        labelKa: 'თვიური შემოსავალი (USD)',
        labelEn: 'Monthly Revenue (USD)',
        placeholderKa: 'მაგ: 850',
        placeholderEn: 'e.g. 850',
        min: 0,
        suffix: 'USD',
      },
      {
        key: 'channelLanguage',
        type: 'text',
        labelKa: 'კონტენტის ენა',
        labelEn: 'Content Language',
        placeholderKa: 'მაგ: ქართული / ინგლისური',
        placeholderEn: 'e.g. Georgian / English',
        maxLength: 60,
      },
      {
        key: 'channelUrl',
        type: 'url',
        labelKa: 'YouTube არხის ბმული',
        labelEn: 'YouTube Channel URL',
        placeholderKa: 'https://www.youtube.com/@channel',
        placeholderEn: 'https://www.youtube.com/@channel',
        maxLength: 300,
      },
      {
        key: 'strikesClean',
        type: 'boolean',
        labelKa: 'სტრაიკებისა და გაფრთხილებების გარეშე',
        labelEn: 'Zero Copyright / Community Strikes',
      },
    ],
  },

  'social-accounts': {
    ...COMMON_PROJECT_BASE,
    categoryId: 'social-accounts',
    locationMode: 'remote',
    titleLabelKa: 'ანგარიშის / გვერდის დასახელება',
    titleLabelEn: 'Account / Page Name',
    titlePlaceholderKa: 'მაგ: Instagram ბიზნეს გვერდი 45K გამომწერით',
    titlePlaceholderEn: 'e.g. Instagram Lifestyle Page with 45K Followers',
    priceLabelKa: 'ანგარიშის ფასი',
    priceLabelEn: 'Account Price',
    descriptionPlaceholderKa: 'აღწერეთ აუდიტორიის აქტიურობა, სტატისტიკა და ანგარიშის გადაცემის დეტალები...',
    descriptionPlaceholderEn: 'Describe audience activity, demographics, insights, and handover terms...',
    fields: [
      {
        key: 'platform',
        type: 'select',
        labelKa: 'სოციალური პლატფორმა',
        labelEn: 'Social Platform',
        required: true,
        showOnCard: true,
        options: [
          { value: 'instagram', labelKa: 'Instagram', labelEn: 'Instagram' },
          { value: 'tiktok', labelKa: 'TikTok', labelEn: 'TikTok' },
          { value: 'facebook', labelKa: 'Facebook', labelEn: 'Facebook' },
          { value: 'telegram', labelKa: 'Telegram', labelEn: 'Telegram' },
          { value: 'x', labelKa: 'X (Twitter)', labelEn: 'X (Twitter)' },
          { value: 'other', labelKa: 'სხვა პლატფორმა', labelEn: 'Other Platform' },
        ],
      },
      {
        key: 'followersCount',
        type: 'number',
        labelKa: 'გამომწერების რაოდენობა',
        labelEn: 'Followers Count',
        placeholderKa: 'მაგ: 35000',
        placeholderEn: 'e.g. 35000',
        required: true,
        min: 0,
        max: 500000000,
        showOnCard: true,
      },
      {
        key: 'niche',
        type: 'text',
        labelKa: 'თემატიკა (ნიშა)',
        labelEn: 'Niche / Topic',
        placeholderKa: 'მაგ: მოდა, სიახლეები, ავტო',
        placeholderEn: 'e.g. Fashion, News, Automotive',
        required: true,
        maxLength: 80,
      },
      {
        key: 'engagementRate',
        type: 'number',
        labelKa: 'ჩართულობის მაჩვენებელი (%)',
        labelEn: 'Engagement Rate (%)',
        placeholderKa: 'მაგ: 4.5',
        placeholderEn: 'e.g. 4.5',
        min: 0,
        max: 100,
        suffix: '%',
      },
      {
        key: 'audienceCountry',
        type: 'text',
        labelKa: 'ძირითადი აუდიტორია (ქვეყანა)',
        labelEn: 'Top Audience Country',
        placeholderKa: 'მაგ: საქართველო / აშშ',
        placeholderEn: 'e.g. Georgia / USA',
        maxLength: 60,
      },
      {
        key: 'accountHandleOrUrl',
        type: 'url',
        labelKa: 'ანგარიშის ბმული (URL)',
        labelEn: 'Account URL',
        placeholderKa: 'https://instagram.com/username',
        placeholderEn: 'https://instagram.com/username',
        maxLength: 300,
      },
      {
        key: 'originalEmailIncluded',
        type: 'boolean',
        labelKa: 'პირველადი ელფოსტა (OG Email) მოყვება',
        labelEn: 'Original Email Included',
      },
    ],
  },

  'project-jobs': {
    ...COMMON_PROJECT_BASE,
    categoryId: 'project-jobs',
    locationMode: 'flexible',
    titleLabelKa: 'ვაკანსიის / დავალების სათაური',
    titleLabelEn: 'Job / Task Title',
    titlePlaceholderKa: 'მაგ: React / TypeScript დეველოპერი ან ვიდეო მემონტაჟე',
    titlePlaceholderEn: 'e.g. Senior React Developer or Video Editor',
    priceLabelKa: 'ანაზღაურება / ბიუჯეტი',
    priceLabelEn: 'Salary / Budget',
    descriptionPlaceholderKa: 'აღწერეთ სამუშაო მოვალეობები, მოთხოვნები, გრაფიკი და ანაზღაურების პირობები...',
    descriptionPlaceholderEn: 'Describe role responsibilities, requirements, schedule, and payment terms...',
    fields: [
      {
        key: 'roleType',
        type: 'select',
        labelKa: 'დასაქმების ტიპი',
        labelEn: 'Engagement Type',
        required: true,
        showOnCard: true,
        options: [
          { value: 'full_time', labelKa: 'სრული განაკვეთი', labelEn: 'Full-Time' },
          { value: 'part_time', labelKa: 'ნახევარი განაკვეთი', labelEn: 'Part-Time' },
          { value: 'freelance_task', labelKa: 'ერთჯერადი დავალება / ფრილანსი', labelEn: 'Freelance / One-time Task' },
          { value: 'contract', labelKa: 'კონტრაქტი / პროექტული', labelEn: 'Contract / Project-based' },
        ],
      },
      {
        key: 'employmentFormat',
        type: 'select',
        labelKa: 'სამუშაო ფორმატი',
        labelEn: 'Work Format',
        required: true,
        showOnCard: true,
        options: [
          { value: 'remote', labelKa: 'დისტანციური', labelEn: 'Remote' },
          { value: 'onsite', labelKa: 'ადგილზე (ოფისი)', labelEn: 'On-site' },
          { value: 'hybrid', labelKa: 'ჰიბრიდული', labelEn: 'Hybrid' },
        ],
      },
      {
        key: 'experienceLevel',
        type: 'select',
        labelKa: 'გამოცდილების დონე',
        labelEn: 'Experience Level',
        options: [
          { value: 'any', labelKa: 'ნებისმიერი', labelEn: 'Any Level' },
          { value: 'junior', labelKa: 'დამწყები (Junior)', labelEn: 'Junior' },
          { value: 'mid', labelKa: 'საშუალო (Mid)', labelEn: 'Mid-Level' },
          { value: 'senior', labelKa: 'უფროსი (Senior)', labelEn: 'Senior' },
        ],
      },
      {
        key: 'requiredSkills',
        type: 'text',
        labelKa: 'საჭირო უნარები / ტექნოლოგიები',
        labelEn: 'Required Skills',
        placeholderKa: 'მაგ: Figma, Premiere Pro, TypeScript',
        placeholderEn: 'e.g. Figma, Premiere Pro, TypeScript',
        maxLength: 160,
      },
      {
        key: 'deadline',
        type: 'text',
        labelKa: 'ვადა ან გრაფიკი',
        labelEn: 'Deadline / Schedule',
        placeholderKa: 'მაგ: 14 დღე ან ორშ-პარ',
        placeholderEn: 'e.g. 2 weeks or Mon-Fri',
        maxLength: 80,
      },
    ],
  },

  'audience-growth': {
    ...COMMON_PROJECT_BASE,
    categoryId: 'audience-growth',
    locationMode: 'remote',
    titleLabelKa: 'პოპულარიზაციის შეთავაზების სათაური',
    titleLabelEn: 'Growth / Promotion Title',
    titlePlaceholderKa: 'მაგ: YouTube არხის ორგანული ზრდა და Google Ads კამპანია',
    titlePlaceholderEn: 'e.g. YouTube Organic Growth & Google Ads Campaign',
    priceLabelKa: 'პაკეტის ფასი / ბიუჯეტი',
    priceLabelEn: 'Package Price / Budget',
    descriptionPlaceholderKa: 'აღწერეთ პრომო სტრატეგია, მიზნობრივი აუდიტორია და მოსალოდნელი შედეგები...',
    descriptionPlaceholderEn: 'Describe promotion strategy, target audience, and expected deliverables...',
    fields: [
      {
        key: 'targetPlatform',
        type: 'select',
        labelKa: 'მიზნობრივი პლატფორმა',
        labelEn: 'Target Platform',
        required: true,
        showOnCard: true,
        options: [
          { value: 'youtube', labelKa: 'YouTube', labelEn: 'YouTube' },
          { value: 'instagram', labelKa: 'Instagram', labelEn: 'Instagram' },
          { value: 'tiktok', labelKa: 'TikTok', labelEn: 'TikTok' },
          { value: 'facebook', labelKa: 'Facebook / Meta', labelEn: 'Facebook / Meta' },
          { value: 'telegram', labelKa: 'Telegram', labelEn: 'Telegram' },
          { value: 'web_seo', labelKa: 'ვებსაიტი / SEO / Google', labelEn: 'Website / SEO / Google' },
          { value: 'multi', labelKa: 'მულტი-პლატფორმული', labelEn: 'Multi-Platform' },
        ],
      },
      {
        key: 'promotionMethod',
        type: 'select',
        labelKa: 'ზრდის მეთოდი',
        labelEn: 'Promotion Method',
        required: true,
        showOnCard: true,
        options: [
          { value: 'organic_growth', labelKa: 'ორგანული ზრდა და კონტენტი', labelEn: 'Organic Growth & Content' },
          { value: 'paid_ads', labelKa: 'ფასიანი რეკლამა (Ads)', labelEn: 'Paid Ads Management' },
          { value: 'influencer_promo', labelKa: 'ინფლუენსერ კამპანია', labelEn: 'Influencer Campaign' },
          { value: 'seo_content', labelKa: 'SEO ოპტიმიზაცია', labelEn: 'SEO Optimization' },
          { value: 'cross_promo', labelKa: 'კროს-პრომო და პარტნიორობა', labelEn: 'Cross-Promotion' },
        ],
      },
      {
        key: 'campaignDuration',
        type: 'text',
        labelKa: 'კამპანიის ხანგრძლივობა',
        labelEn: 'Campaign Duration',
        placeholderKa: 'მაგ: 30 დღე',
        placeholderEn: 'e.g. 30 days',
        maxLength: 60,
      },
      {
        key: 'expectedReach',
        type: 'text',
        labelKa: 'მოსალოდნელი შედეგი / დაფარვა',
        labelEn: 'Expected Reach / Deliverable',
        placeholderKa: 'მაგ: 50K–100K მიზნობრივი ნახვა',
        placeholderEn: 'e.g. 50K–100K targeted reach',
        maxLength: 100,
      },
      {
        key: 'caseStudyUrl',
        type: 'url',
        labelKa: 'პორტფოლიო / ქეისის ბმული',
        labelEn: 'Portfolio / Case Study URL',
        placeholderKa: 'https://example.com/portfolio',
        placeholderEn: 'https://example.com/portfolio',
        maxLength: 300,
      },
    ],
  },

  'collaboration': {
    ...COMMON_PROJECT_BASE,
    categoryId: 'collaboration',
    locationMode: 'flexible',
    titleLabelKa: 'თანამშრომლობის / პარტნიორობის სათაური',
    titleLabelEn: 'Collaboration / Partnership Title',
    titlePlaceholderKa: 'მაგ: ვეძებ ტექნიკურ თანადამფუძნებელს SaaS პროექტში',
    titlePlaceholderEn: 'e.g. Looking for Technical Co-Founder for SaaS Startup',
    priceLabelKa: 'სავარაუდო ბიუჯეტი / ინვესტიცია',
    priceLabelEn: 'Estimated Budget / Investment',
    descriptionPlaceholderKa: 'აღწერეთ პროექტის იდეა, თქვენი წვლილი და რა ტიპის პარტნიორს ეძებთ...',
    descriptionPlaceholderEn: 'Describe the project idea, your contribution, and the ideal partner profile...',
    fields: [
      {
        key: 'partnershipModel',
        type: 'select',
        labelKa: 'თანამშრომლობის ფორმატი',
        labelEn: 'Partnership Model',
        required: true,
        showOnCard: true,
        options: [
          { value: 'equity', labelKa: 'წილობრივი პარტნიორობა (Equity)', labelEn: 'Equity Partnership' },
          { value: 'revenue_share', labelKa: 'შემოსავლის გაზიარება (RevShare)', labelEn: 'Revenue Share' },
          { value: 'content_collab', labelKa: 'კონტენტ კოლაბორაცია', labelEn: 'Content Collaboration' },
          { value: 'investment', labelKa: 'ინვესტიცია / დაფინანსება', labelEn: 'Investment / Funding' },
          { value: 'joint_venture', labelKa: 'ერთობლივი პროექტი', labelEn: 'Joint Venture' },
        ],
      },
      {
        key: 'projectStage',
        type: 'select',
        labelKa: 'პროექტის ეტაპი',
        labelEn: 'Project Stage',
        required: true,
        showOnCard: true,
        options: [
          { value: 'idea', labelKa: 'იდეა / კონცეფცია', labelEn: 'Idea / Concept' },
          { value: 'mvp', labelKa: 'პროტოტიპი / MVP', labelEn: 'Prototype / MVP' },
          { value: 'active_revenue', labelKa: 'მოქმედი შემოსავლით', labelEn: 'Live with Revenue' },
          { value: 'scaling', labelKa: 'მასშტაბირების ეტაპი', labelEn: 'Scaling' },
        ],
      },
      {
        key: 'equityOrSharePercent',
        type: 'number',
        labelKa: 'შემოთავაზებული წილი (%)',
        labelEn: 'Offered Share / Equity (%)',
        placeholderKa: 'მაგ: 25',
        placeholderEn: 'e.g. 25',
        min: 0,
        max: 100,
        suffix: '%',
      },
      {
        key: 'partnerContribution',
        type: 'text',
        labelKa: 'ვის ან რა რესურსს ეძებთ',
        labelEn: 'Seeking Partner Contribution',
        placeholderKa: 'მაგ: დეველოპმენტი, მარკეტინგი, კაპიტალი',
        placeholderEn: 'e.g. Engineering, Marketing, Capital',
        maxLength: 140,
      },
    ],
  },

  'digital-projects': {
    ...COMMON_PROJECT_BASE,
    categoryId: 'digital-projects',
    locationMode: 'remote',
    titleLabelKa: 'ციფრული პროექტის დასახელება',
    titleLabelEn: 'Digital Project Name',
    titlePlaceholderKa: 'მაგ: მოქმედი SaaS პლატფორმა ან E-commerce მაღაზია',
    titlePlaceholderEn: 'e.g. Turnkey SaaS Platform or E-commerce Business',
    priceLabelKa: 'პროექტის ფასი',
    priceLabelEn: 'Project Price',
    descriptionPlaceholderKa: 'აღწერეთ პროექტის ბიზნეს-მოდელი, ტექნოლოგიები, ტრაფიკი და რა აქტივები გადაეცემა მყიდველს...',
    descriptionPlaceholderEn: 'Describe business model, architecture, traffic, and all included digital assets...',
    fields: [
      {
        key: 'projectType',
        type: 'select',
        labelKa: 'პროექტის ტიპი',
        labelEn: 'Project Type',
        required: true,
        showOnCard: true,
        options: [
          { value: 'saas', labelKa: 'SaaS / ვებ-აპლიკაცია', labelEn: 'SaaS / Web App' },
          { value: 'website', labelKa: 'ვებსაიტი / პორტალი', labelEn: 'Website / Portal' },
          { value: 'ecommerce', labelKa: 'ონლაინ მაღაზია (E-commerce)', labelEn: 'E-Commerce Store' },
          { value: 'mobile_app', labelKa: 'მობილური აპლიკაცია', labelEn: 'Mobile App' },
          { value: 'bot_script', labelKa: 'ბოტი / ავტომატიზაცია', labelEn: 'Bot / Automation' },
          { value: 'other', labelKa: 'სხვა ციფრული პროექტი', labelEn: 'Other Digital Asset' },
        ],
      },
      {
        key: 'assetsIncluded',
        type: 'text',
        labelKa: 'შემავალი აქტივები',
        labelEn: 'Included Assets',
        placeholderKa: 'მაგ: დომენი, საწყისი კოდი, ბაზა, სოც. გვერდები',
        placeholderEn: 'e.g. Domain, Source Code, DB, Social Pages',
        required: true,
        maxLength: 160,
      },
      {
        key: 'techStack',
        type: 'text',
        labelKa: 'ტექნოლოგიური სტეკი',
        labelEn: 'Tech Stack',
        placeholderKa: 'მაგ: React, Node.js, Firebase, Stripe',
        placeholderEn: 'e.g. React, Node.js, Firebase, Stripe',
        maxLength: 120,
        showOnCard: true,
      },
      {
        key: 'monthlyRevenue',
        type: 'number',
        labelKa: 'თვიური შემოსავალი (USD)',
        labelEn: 'Monthly Revenue (USD)',
        placeholderKa: 'მაგ: 1200',
        placeholderEn: 'e.g. 1200',
        min: 0,
        suffix: 'USD',
      },
      {
        key: 'monthlyUsers',
        type: 'number',
        labelKa: 'თვიური მომხმარებლები / ვიზიტები',
        labelEn: 'Monthly Users / Visits',
        placeholderKa: 'მაგ: 15000',
        placeholderEn: 'e.g. 15000',
        min: 0,
      },
      {
        key: 'demoUrl',
        type: 'url',
        labelKa: 'საიტის / დემოს ბმული',
        labelEn: 'Live Site / Demo URL',
        placeholderKa: 'https://myproject.com',
        placeholderEn: 'https://myproject.com',
        maxLength: 300,
      },
    ],
  },

  // =========================================================
  // SERVICE (2 active categories)
  // =========================================================
  'service': {
    ...COMMON_SERVICE_BASE,
    categoryId: 'service',
    locationMode: 'flexible',
    fields: [
      {
        key: 'deliveryFormat',
        type: 'select',
        labelKa: 'მომსახურების ფორმატი',
        labelEn: 'Delivery Format',
        required: true,
        showOnCard: true,
        options: [
          { value: 'onsite', labelKa: 'ადგილზე / გამოძახებით', labelEn: 'On-site / In-person' },
          { value: 'remote', labelKa: 'დისტანციურად (ონლაინ)', labelEn: 'Remote / Online' },
          { value: 'hybrid', labelKa: 'ორივე (ადგილზე და ონლაინ)', labelEn: 'Both (On-site & Remote)' },
        ],
      },
      {
        key: 'pricingUnit',
        type: 'select',
        labelKa: 'ფასის ერთეული',
        labelEn: 'Pricing Unit',
        required: true,
        showOnCard: true,
        options: [
          { value: 'fixed', labelKa: 'ფიქსირებული სერვისი', labelEn: 'Fixed Price' },
          { value: 'hourly', labelKa: 'საათობრივი ტარიფი', labelEn: 'Hourly Rate' },
          { value: 'daily', labelKa: 'დღიური ტარიფი', labelEn: 'Daily Rate' },
          { value: 'per_project', labelKa: 'პროექტის მიხედვით', labelEn: 'Per Project' },
        ],
      },
      {
        key: 'experienceYears',
        type: 'number',
        labelKa: 'გამოცდილება (წელი)',
        labelEn: 'Years of Experience',
        placeholderKa: 'მაგ: 5',
        placeholderEn: 'e.g. 5',
        min: 0,
        max: 80,
        suffix: 'წ.',
      },
      {
        key: 'portfolioUrl',
        type: 'url',
        labelKa: 'პორტფოლიოს ბმული',
        labelEn: 'Portfolio URL',
        placeholderKa: 'https://portfolio.example.com',
        placeholderEn: 'https://portfolio.example.com',
        maxLength: 300,
      },
    ],
  },

  'rent': {
    ...COMMON_SERVICE_BASE,
    categoryId: 'rent',
    locationMode: 'physical',
    titleLabelKa: 'გასაქირავებელი ობიექტის / ნივთის სახელი',
    titleLabelEn: 'Rental Item / Space Title',
    titlePlaceholderKa: 'მაგ: Sony FX3 კამერის კომპლექტი ან საოფისე ფართი',
    titlePlaceholderEn: 'e.g. Sony FX3 Cinema Camera Kit or Office Space',
    priceLabelKa: 'ქირის ფასი',
    priceLabelEn: 'Rental Price',
    descriptionPlaceholderKa: 'აღწერეთ გაქირავების პირობები, მდგომარეობა, ჩაბარება-დაბრუნების წესები...',
    descriptionPlaceholderEn: 'Describe rental terms, item condition, pickup, and return policy...',
    fields: [
      {
        key: 'rentalCategory',
        type: 'select',
        labelKa: 'გაქირავების ტიპი',
        labelEn: 'Rental Type',
        required: true,
        showOnCard: true,
        options: [
          { value: 'equipment', labelKa: 'ტექნიკა და აპარატურა', labelEn: 'Tech & Equipment' },
          { value: 'tools', labelKa: 'ხელსაწყოები და დანადგარები', labelEn: 'Tools & Machinery' },
          { value: 'vehicle', labelKa: 'ტრანსპორტი / ავტო', labelEn: 'Vehicles & Transport' },
          { value: 'space_office', labelKa: 'სივრცე / ფართი / სტუდია', labelEn: 'Space / Office / Studio' },
          { value: 'event_gear', labelKa: 'ივენთ ინვენტარი', labelEn: 'Event Inventory' },
          { value: 'other', labelKa: 'სხვა', labelEn: 'Other' },
        ],
      },
      {
        key: 'rentalPeriod',
        type: 'select',
        labelKa: 'ქირის პერიოდი',
        labelEn: 'Rental Period',
        required: true,
        showOnCard: true,
        options: [
          { value: 'hourly', labelKa: 'საათობრივად', labelEn: 'Per Hour' },
          { value: 'daily', labelKa: 'დღიურად', labelEn: 'Per Day' },
          { value: 'weekly', labelKa: 'კვირით', labelEn: 'Per Week' },
          { value: 'monthly', labelKa: 'თვიურად', labelEn: 'Per Month' },
        ],
      },
      {
        key: 'depositRequired',
        type: 'boolean',
        labelKa: 'საჭიროა საგარანტიო დეპოზიტი',
        labelEn: 'Security Deposit Required',
      },
      {
        key: 'depositAmount',
        type: 'number',
        labelKa: 'დეპოზიტის თანხა',
        labelEn: 'Deposit Amount',
        placeholderKa: 'მაგ: 200',
        placeholderEn: 'e.g. 200',
        min: 0,
      },
    ],
  },

  // =========================================================
  // PRODUCT (17 active categories)
  // =========================================================
  'phones': {
    ...COMMON_PRODUCT_BASE,
    categoryId: 'phones',
    titleLabelKa: 'ტელეფონის / აქსესუარის დასახელება',
    titleLabelEn: 'Phone / Accessory Title',
    titlePlaceholderKa: 'მაგ: iPhone 15 Pro Max 256GB Natural Titanium',
    titlePlaceholderEn: 'e.g. iPhone 15 Pro Max 256GB Natural Titanium',
    fields: [
      {
        key: 'brand',
        type: 'text',
        labelKa: 'ბრენდი',
        labelEn: 'Brand',
        placeholderKa: 'მაგ: Apple, Samsung, Xiaomi',
        placeholderEn: 'e.g. Apple, Samsung, Xiaomi',
        required: true,
        maxLength: 50,
        showOnCard: true,
      },
      {
        key: 'model',
        type: 'text',
        labelKa: 'მოდელი',
        labelEn: 'Model',
        placeholderKa: 'მაგ: 15 Pro Max / Galaxy S24',
        placeholderEn: 'e.g. 15 Pro Max / Galaxy S24',
        required: true,
        maxLength: 70,
        showOnCard: true,
      },
      {
        key: 'storageGb',
        type: 'select',
        labelKa: 'შიდა მეხსიერება',
        labelEn: 'Storage Capacity',
        showOnCard: true,
        options: [
          { value: '32GB', labelKa: '32 GB', labelEn: '32 GB' },
          { value: '64GB', labelKa: '64 GB', labelEn: '64 GB' },
          { value: '128GB', labelKa: '128 GB', labelEn: '128 GB' },
          { value: '256GB', labelKa: '256 GB', labelEn: '256 GB' },
          { value: '512GB', labelKa: '512 GB', labelEn: '512 GB' },
          { value: '1TB', labelKa: '1 TB', labelEn: '1 TB' },
          { value: 'accessory', labelKa: 'აქსესუარი (მეხსიერების გარეშე)', labelEn: 'Accessory (N/A)' },
        ],
      },
      {
        key: 'ramGb',
        type: 'number',
        labelKa: 'ოპერატიული მეხსიერება (RAM GB)',
        labelEn: 'RAM (GB)',
        placeholderKa: 'მაგ: 8',
        placeholderEn: 'e.g. 8',
        min: 1,
        max: 64,
        suffix: 'GB',
      },
      {
        key: 'batteryHealth',
        type: 'number',
        labelKa: 'ელემენტის მდგომარეობა (%)',
        labelEn: 'Battery Health (%)',
        placeholderKa: 'მაგ: 94',
        placeholderEn: 'e.g. 94',
        min: 1,
        max: 100,
        suffix: '%',
      },
      {
        key: 'simType',
        type: 'select',
        labelKa: 'SIM / ქსელის ტიპი',
        labelEn: 'SIM / Carrier Status',
        options: [
          { value: 'unlocked_physical', labelKa: 'Sim Free (ფიზიკური SIM)', labelEn: 'Unlocked (Physical SIM)' },
          { value: 'esim', labelKa: 'eSIM / Sim Free', labelEn: 'Unlocked (eSIM)' },
          { value: 'dual_sim', labelKa: 'Dual SIM (2 ბარათი)', labelEn: 'Dual SIM' },
          { value: 'locked', labelKa: 'დაბლოკილია ოპერატორზე', labelEn: 'Carrier Locked' },
        ],
      },
    ],
  },

  'technics': {
    ...COMMON_PRODUCT_BASE,
    categoryId: 'technics',
    titleLabelKa: 'ტექნიკის დასახელება',
    titleLabelEn: 'Electronics Title',
    titlePlaceholderKa: 'მაგ: MacBook Pro M3 14" 16GB / 512GB',
    titlePlaceholderEn: 'e.g. MacBook Pro M3 14" 16GB / 512GB',
    fields: [
      {
        key: 'brand',
        type: 'text',
        labelKa: 'ბრენდი',
        labelEn: 'Brand',
        placeholderKa: 'მაგ: Apple, ASUS, Sony, Dell',
        placeholderEn: 'e.g. Apple, ASUS, Sony, Dell',
        required: true,
        maxLength: 50,
        showOnCard: true,
      },
      {
        key: 'model',
        type: 'text',
        labelKa: 'მოდელი',
        labelEn: 'Model',
        placeholderKa: 'მაგ: ROG Strix G16',
        placeholderEn: 'e.g. ROG Strix G16',
        maxLength: 80,
        showOnCard: true,
      },
      {
        key: 'specsSummary',
        type: 'text',
        labelKa: 'ძირითადი მახასიათებლები',
        labelEn: 'Key Specifications',
        placeholderKa: 'მაგ: i7-13700H, RTX 4060, 16GB RAM, 1TB SSD',
        placeholderEn: 'e.g. i7-13700H, RTX 4060, 16GB RAM, 1TB SSD',
        maxLength: 140,
      },
      {
        key: 'accessoriesIncluded',
        type: 'text',
        labelKa: 'კომპლექტაცია',
        labelEn: 'Included Accessories',
        placeholderKa: 'მაგ: ორიგინალი დამტენი, ყუთი',
        placeholderEn: 'e.g. Original charger, box',
        maxLength: 100,
      },
      {
        key: 'warrantyIncluded',
        type: 'boolean',
        labelKa: 'მოქმედი გარანტია',
        labelEn: 'Warranty Included',
      },
    ],
  },

  'family-technic': {
    ...COMMON_PRODUCT_BASE,
    categoryId: 'family-technic',
    titleLabelKa: 'საყოფაცხოვრებო ტექნიკის სახელი',
    titleLabelEn: 'Home Appliance Title',
    titlePlaceholderKa: 'მაგ: Bosch სარეცხი მანქანა 8 კგ',
    titlePlaceholderEn: 'e.g. Bosch Front-Load Washing Machine 8kg',
    fields: [
      {
        key: 'applianceType',
        type: 'select',
        labelKa: 'ტექნიკის კატეგორია',
        labelEn: 'Appliance Type',
        required: true,
        showOnCard: true,
        options: [
          { value: 'refrigerator', labelKa: 'მაცივარი / საყინულე', labelEn: 'Refrigerator / Freezer' },
          { value: 'washing_machine', labelKa: 'სარეცხი / საშრობი მანქანა', labelEn: 'Washer / Dryer' },
          { value: 'air_conditioner', labelKa: 'კონდიციონერი / გამათბობელი', labelEn: 'AC / Heating' },
          { value: 'kitchen_appliance', labelKa: 'სამზარეულოს ტექნიკა', labelEn: 'Kitchen Appliance' },
          { value: 'vacuum', labelKa: 'მტვერსასრუტი / დასუფთავება', labelEn: 'Vacuum / Cleaning' },
          { value: 'tv_audio', labelKa: 'ტელევიზორი / აუდიო', labelEn: 'TV & Audio' },
          { value: 'other', labelKa: 'სხვა ტექნიკა', labelEn: 'Other Appliance' },
        ],
      },
      {
        key: 'brand',
        type: 'text',
        labelKa: 'ბრენდი',
        labelEn: 'Brand',
        placeholderKa: 'მაგ: Bosch, Samsung, LG, Beko',
        placeholderEn: 'e.g. Bosch, Samsung, LG, Beko',
        maxLength: 50,
        showOnCard: true,
      },
      {
        key: 'energyClass',
        type: 'select',
        labelKa: 'ენერგოეფექტურობის კლასი',
        labelEn: 'Energy Class',
        options: [
          { value: 'A+++', labelKa: 'A+++', labelEn: 'A+++' },
          { value: 'A++', labelKa: 'A++', labelEn: 'A++' },
          { value: 'A+', labelKa: 'A+', labelEn: 'A+' },
          { value: 'A', labelKa: 'A', labelEn: 'A' },
          { value: 'B', labelKa: 'B', labelEn: 'B' },
          { value: 'other', labelKa: 'სხვა', labelEn: 'Other' },
        ],
      },
      {
        key: 'warrantyIncluded',
        type: 'boolean',
        labelKa: 'გარანტია მოყვება',
        labelEn: 'Warranty Included',
      },
    ],
  },

  'furniture': {
    ...COMMON_PRODUCT_BASE,
    categoryId: 'furniture',
    titleLabelKa: 'ავეჯის დასახელება',
    titleLabelEn: 'Furniture Title',
    titlePlaceholderKa: 'მაგ: მუხის სასადილო მაგიდა ან კუთხის დივანი',
    titlePlaceholderEn: 'e.g. Solid Oak Dining Table or Sectional Sofa',
    fields: [
      {
        key: 'material',
        type: 'text',
        labelKa: 'მასალა',
        labelEn: 'Material',
        placeholderKa: 'მაგ: მასიური ხე, MDF, ველვეტი',
        placeholderEn: 'e.g. Solid wood, MDF, Velvet',
        maxLength: 80,
        showOnCard: true,
      },
      {
        key: 'dimensions',
        type: 'text',
        labelKa: 'ზომები (სიგრძე x სიგანე x სიმაღლე)',
        labelEn: 'Dimensions (L x W x H)',
        placeholderKa: 'მაგ: 200 x 90 x 75 სმ',
        placeholderEn: 'e.g. 200 x 90 x 75 cm',
        maxLength: 80,
        showOnCard: true,
      },
      {
        key: 'color',
        type: 'text',
        labelKa: 'ფერი',
        labelEn: 'Color',
        placeholderKa: 'მაგ: კაკლისფერი / გრაფიტი',
        placeholderEn: 'e.g. Walnut / Charcoal',
        maxLength: 50,
      },
      {
        key: 'deliveryAvailable',
        type: 'boolean',
        labelKa: 'ადგილზე მიტანა / აწყობა შესაძლებელია',
        labelEn: 'Delivery / Assembly Available',
      },
    ],
  },

  'garden': {
    ...COMMON_PRODUCT_BASE,
    categoryId: 'garden',
    titleLabelKa: 'სახლისა და ბაღის ნივთის სახელი',
    titleLabelEn: 'Home & Garden Item Title',
    titlePlaceholderKa: 'მაგ: ბაღის კომპლექტი ან გაზონის სათიბი',
    titlePlaceholderEn: 'e.g. Patio Furniture Set or Lawn Mower',
    fields: [
      {
        key: 'material',
        type: 'text',
        labelKa: 'მასალა / ტიპი',
        labelEn: 'Material / Type',
        placeholderKa: 'მაგ: რატანი, მეტალი, კერამიკა',
        placeholderEn: 'e.g. Rattan, Metal, Ceramic',
        maxLength: 80,
        showOnCard: true,
      },
      {
        key: 'dimensions',
        type: 'text',
        labelKa: 'ზომები / მოცულობა',
        labelEn: 'Dimensions / Capacity',
        placeholderKa: 'მაგ: 150 x 80 სმ',
        placeholderEn: 'e.g. 150 x 80 cm',
        maxLength: 80,
      },
      {
        key: 'color',
        type: 'text',
        labelKa: 'ფერი',
        labelEn: 'Color',
        placeholderKa: 'მაგ: მწვანე / შავი',
        placeholderEn: 'e.g. Green / Black',
        maxLength: 50,
      },
      {
        key: 'deliveryAvailable',
        type: 'boolean',
        labelKa: 'მიტანა შესაძლებელია',
        labelEn: 'Delivery Available',
      },
    ],
  },

  'building': {
    ...COMMON_PRODUCT_BASE,
    categoryId: 'building',
    titleLabelKa: 'სამშენებლო / სარემონტო ნივთის სახელი',
    titleLabelEn: 'Construction & Renovation Item Title',
    titlePlaceholderKa: 'მაგ: Bosch პერფორატორი ან კერამიკული ფილები',
    titlePlaceholderEn: 'e.g. Bosch Rotary Hammer or Ceramic Tiles',
    fields: [
      {
        key: 'material',
        type: 'text',
        labelKa: 'მასალა / ტიპი',
        labelEn: 'Material / Category',
        placeholderKa: 'მაგ: ლითონი, კერამიკა, ელექტროინსტრუმენტი',
        placeholderEn: 'e.g. Steel, Ceramic, Power Tool',
        maxLength: 80,
        showOnCard: true,
      },
      {
        key: 'quantityOrArea',
        type: 'text',
        labelKa: 'რაოდენობა / ფართობი / ერთეული',
        labelEn: 'Quantity / Area / Unit',
        placeholderKa: 'მაგ: 45 კვ.მ ან 10 ტომარა',
        placeholderEn: 'e.g. 45 sq.m or 10 bags',
        maxLength: 80,
        showOnCard: true,
      },
      {
        key: 'dimensions',
        type: 'text',
        labelKa: 'ზომები / სპეციფიკაცია',
        labelEn: 'Dimensions / Spec',
        placeholderKa: 'მაგ: 60x60 სმ / 1500W',
        placeholderEn: 'e.g. 60x60 cm / 1500W',
        maxLength: 80,
      },
      {
        key: 'deliveryAvailable',
        type: 'boolean',
        labelKa: 'ადგილზე მიტანა შესაძლებელია',
        labelEn: 'Delivery Available',
      },
    ],
  },

  'fashion': {
    ...COMMON_PRODUCT_BASE,
    categoryId: 'fashion',
    titleLabelKa: 'პროდუქტის დასახელება (სილამაზე/მოვლა)',
    titleLabelEn: 'Beauty & Personal Care Title',
    titlePlaceholderKa: 'მაგ: Dior Sauvage Eau de Parfum 100ml',
    titlePlaceholderEn: 'e.g. Dior Sauvage Eau de Parfum 100ml',
    fields: [
      {
        key: 'brand',
        type: 'text',
        labelKa: 'ბრენდი',
        labelEn: 'Brand',
        placeholderKa: 'მაგ: Dior, La Roche-Posay, Dyson',
        placeholderEn: 'e.g. Dior, La Roche-Posay, Dyson',
        maxLength: 60,
        showOnCard: true,
      },
      {
        key: 'sizeOrVolume',
        type: 'text',
        labelKa: 'მოცულობა / ზომა',
        labelEn: 'Volume / Size',
        placeholderKa: 'მაგ: 100 მლ / სტანდარტული',
        placeholderEn: 'e.g. 100 ml / Standard',
        maxLength: 50,
        showOnCard: true,
      },
      {
        key: 'genderOrTarget',
        type: 'select',
        labelKa: 'დანიშნულება',
        labelEn: 'Target',
        options: [
          { value: 'unisex', labelKa: 'უნივერსალური', labelEn: 'Unisex' },
          { value: 'women', labelKa: 'ქალისთვის', labelEn: 'Women' },
          { value: 'men', labelKa: 'მამაკაცისთვის', labelEn: 'Men' },
        ],
      },
      {
        key: 'originalAuthentic',
        type: 'boolean',
        labelKa: 'ორიგინალი / დალუქული პროდუქტი',
        labelEn: '100% Authentic / Sealed',
      },
    ],
  },

  'kids': {
    ...COMMON_PRODUCT_BASE,
    categoryId: 'kids',
    titleLabelKa: 'საბავშვო პროდუქტის დასახელება',
    titleLabelEn: 'Kids & Baby Item Title',
    titlePlaceholderKa: 'მაგ: Cybex ეტლი ან Lego Technic კომპლექტი',
    titlePlaceholderEn: 'e.g. Cybex Stroller or Lego Technic Set',
    fields: [
      {
        key: 'ageGroup',
        type: 'select',
        labelKa: 'ასაკობრივი ჯგუფი',
        labelEn: 'Age Group',
        showOnCard: true,
        options: [
          { value: '0-1', labelKa: '0–1 წელი (ჩვილი)', labelEn: '0–1 Year (Infant)' },
          { value: '1-3', labelKa: '1–3 წელი', labelEn: '1–3 Years' },
          { value: '3-6', labelKa: '3–6 წელი', labelEn: '3–6 Years' },
          { value: '6-12', labelKa: '6–12 წელი', labelEn: '6–12 Years' },
          { value: '12+', labelKa: '12+ წელი', labelEn: '12+ Years' },
        ],
      },
      {
        key: 'genderOrTarget',
        type: 'select',
        labelKa: 'სქესი / დანიშნულება',
        labelEn: 'Target',
        showOnCard: true,
        options: [
          { value: 'unisex', labelKa: 'უნივერსალური', labelEn: 'Unisex' },
          { value: 'girl', labelKa: 'გოგონასთვის', labelEn: 'Girl' },
          { value: 'boy', labelKa: 'ბიჭისთვის', labelEn: 'Boy' },
        ],
      },
      {
        key: 'brand',
        type: 'text',
        labelKa: 'ბრენდი',
        labelEn: 'Brand',
        placeholderKa: 'მაგ: Chicco, Cybex, Lego',
        placeholderEn: 'e.g. Chicco, Cybex, Lego',
        maxLength: 50,
      },
      {
        key: 'sizeOrSpecs',
        type: 'text',
        labelKa: 'ზომა / მახასიათებელი',
        labelEn: 'Size / Spec',
        placeholderKa: 'მაგ: 98 სმ / 3-1 კომპლექტი',
        placeholderEn: 'e.g. Size 98 / 3-in-1 travel system',
        maxLength: 70,
      },
    ],
  },

  'sport': {
    ...COMMON_PRODUCT_BASE,
    categoryId: 'sport',
    titleLabelKa: 'სპორტული ინვენტარის სახელი',
    titleLabelEn: 'Sports & Recreation Title',
    titlePlaceholderKa: 'მაგ: Trek ველოსიპედი ან სარბენი ბილიკი',
    titlePlaceholderEn: 'e.g. Trek Mountain Bike or Home Treadmill',
    fields: [
      {
        key: 'brand',
        type: 'text',
        labelKa: 'ბრენდი',
        labelEn: 'Brand',
        placeholderKa: 'მაგ: Nike, Trek, Salomon, Technogym',
        placeholderEn: 'e.g. Nike, Trek, Salomon, Technogym',
        maxLength: 60,
        showOnCard: true,
      },
      {
        key: 'sizeOrWeight',
        type: 'text',
        labelKa: 'ზომა / წონა / პარამეტრი',
        labelEn: 'Size / Weight / Spec',
        placeholderKa: 'მაგ: ჩარჩო L / 29" / 20 კგ',
        placeholderEn: 'e.g. Frame L / 29" / 20 kg',
        maxLength: 70,
        showOnCard: true,
      },
      {
        key: 'genderOrTarget',
        type: 'select',
        labelKa: 'დანიშნულება',
        labelEn: 'Target',
        options: [
          { value: 'unisex', labelKa: 'უნივერსალური', labelEn: 'Unisex' },
          { value: 'adult', labelKa: 'მოზრდილთათვის', labelEn: 'Adult' },
          { value: 'kids', labelKa: 'ბავშვებისთვის', labelEn: 'Kids' },
        ],
      },
      {
        key: 'originalAuthentic',
        type: 'boolean',
        labelKa: 'ორიგინალი ბრენდი',
        labelEn: 'Authentic Original',
      },
    ],
  },

  'business': {
    ...COMMON_PRODUCT_BASE,
    categoryId: 'business',
    titleLabelKa: 'ბიზნეს-დანადგარის დასახელება',
    titleLabelEn: 'Business Equipment Title',
    titlePlaceholderKa: 'მაგ: La Marzocco ყავის აპარატი ან POS ტერმინალი',
    titlePlaceholderEn: 'e.g. Commercial Espresso Machine or CNC Router',
    fields: [
      {
        key: 'equipmentType',
        type: 'text',
        labelKa: 'დანადგარის ტიპი / სფერო',
        labelEn: 'Equipment Type / Industry',
        placeholderKa: 'მაგ: HoReCa, საწარმოო, მაღაზიის ინვენტარი',
        placeholderEn: 'e.g. HoReCa, Manufacturing, Retail POS',
        required: true,
        maxLength: 80,
        showOnCard: true,
      },
      {
        key: 'brandOrManufacturer',
        type: 'text',
        labelKa: 'მწარმოებელი / ბრენდი',
        labelEn: 'Manufacturer / Brand',
        placeholderKa: 'მაგ: La Marzocco, Haas, Rational',
        placeholderEn: 'e.g. La Marzocco, Haas, Rational',
        maxLength: 70,
        showOnCard: true,
      },
      {
        key: 'powerOrCapacity',
        type: 'text',
        labelKa: 'სიმძლავრე / წარმადობა',
        labelEn: 'Power / Capacity',
        placeholderKa: 'მაგ: 380V / 4.5 kW',
        placeholderEn: 'e.g. 380V / 4.5 kW',
        maxLength: 80,
      },
      {
        key: 'yearOfManufacture',
        type: 'number',
        labelKa: 'გამოშვების წელი',
        labelEn: 'Year of Manufacture',
        placeholderKa: 'მაგ: 2022',
        placeholderEn: 'e.g. 2022',
        min: 1950,
        max: 2035,
      },
      {
        key: 'documentationAvailable',
        type: 'boolean',
        labelKa: 'ტექნიკური საბუთები / ინვოისი მოყვება',
        labelEn: 'Technical Docs / Invoice Available',
      },
    ],
  },

  'village': {
    ...COMMON_PRODUCT_BASE,
    categoryId: 'village',
    titleLabelKa: 'სოფლის მეურნეობის პროდუქტის სახელი',
    titleLabelEn: 'Agricultural Product Title',
    titlePlaceholderKa: 'მაგ: კახური ცივი დაწურვის ზეთი ან მინი ტრაქტორი',
    titlePlaceholderEn: 'e.g. Organic Honey or Compact Farm Tractor',
    fields: [
      {
        key: 'productOrigin',
        type: 'text',
        labelKa: 'წარმოშობა / რეგიონი',
        labelEn: 'Origin / Region',
        placeholderKa: 'მაგ: კახეთი / იმერეთი',
        placeholderEn: 'e.g. Kakheti / Imereti',
        maxLength: 70,
        showOnCard: true,
      },
      {
        key: 'unitType',
        type: 'select',
        labelKa: 'საზომი ერთეული',
        labelEn: 'Unit Type',
        showOnCard: true,
        options: [
          { value: 'kg', labelKa: 'კილოგრამი (კგ)', labelEn: 'Kilogram (kg)' },
          { value: 'ton', labelKa: 'ტონა', labelEn: 'Ton' },
          { value: 'liter', labelKa: 'ლიტრი', labelEn: 'Liter' },
          { value: 'piece', labelKa: 'ცალი / ერთეული', labelEn: 'Piece / Unit' },
          { value: 'package', labelKa: 'შეფუთვა / ტომარა', labelEn: 'Package / Bag' },
        ],
      },
      {
        key: 'harvestOrYear',
        type: 'text',
        labelKa: 'მოსავლის წელი / სეზონი',
        labelEn: 'Harvest / Year',
        placeholderKa: 'მაგ: 2025 წლის მოსავალი',
        placeholderEn: 'e.g. 2025 Harvest',
        maxLength: 50,
      },
    ],
  },

  'animals': {
    ...COMMON_PRODUCT_BASE,
    categoryId: 'animals',
    titleLabelKa: 'ცხოველის / აქსესუარის დასახელება',
    titleLabelEn: 'Pet / Accessory Title',
    titlePlaceholderKa: 'მაგ: ლაბრადორის ლეკვი ან კატის სათამაშო სახლი',
    titlePlaceholderEn: 'e.g. Golden Retriever Puppy or Cat Tree House',
    fields: [
      {
        key: 'speciesOrBreed',
        type: 'text',
        labelKa: 'სახეობა / ჯიში',
        labelEn: 'Species / Breed',
        placeholderKa: 'მაგ: გერმანული ნაგაზი, ბრიტანული კატა, თუთიყუში',
        placeholderEn: 'e.g. German Shepherd, British Shorthair, Parrot',
        required: true,
        maxLength: 80,
        showOnCard: true,
      },
      {
        key: 'age',
        type: 'text',
        labelKa: 'ასაკი',
        labelEn: 'Age',
        placeholderKa: 'მაგ: 3 თვის / 1 წლის',
        placeholderEn: 'e.g. 3 months / 1 year',
        maxLength: 40,
        showOnCard: true,
      },
      {
        key: 'vaccinated',
        type: 'boolean',
        labelKa: 'აცრილია / ვეტერინარული პასპორტით',
        labelEn: 'Vaccinated / Vet Passport',
      },
    ],
  },

  'music': {
    ...COMMON_PRODUCT_BASE,
    categoryId: 'music',
    titleLabelKa: 'მუსიკალური ინსტრუმენტის სახელი',
    titleLabelEn: 'Musical Instrument Title',
    titlePlaceholderKa: 'მაგ: Fender Stratocaster ან Roland FP-30X',
    titlePlaceholderEn: 'e.g. Fender Stratocaster or Roland FP-30X',
    fields: [
      {
        key: 'instrumentType',
        type: 'text',
        labelKa: 'ინსტრუმენტის ტიპი',
        labelEn: 'Instrument Type',
        placeholderKa: 'მაგ: ელექტრო გიტარა, ციფრული პიანინო, სტუდიური მონიტორი',
        placeholderEn: 'e.g. Electric Guitar, Digital Piano, Studio Monitor',
        maxLength: 70,
        showOnCard: true,
      },
      {
        key: 'brand',
        type: 'text',
        labelKa: 'ბრენდი',
        labelEn: 'Brand',
        placeholderKa: 'მაგ: Fender, Yamaha, Gibson, Roland',
        placeholderEn: 'e.g. Fender, Yamaha, Gibson, Roland',
        maxLength: 50,
        showOnCard: true,
      },
      {
        key: 'model',
        type: 'text',
        labelKa: 'მოდელი',
        labelEn: 'Model',
        placeholderKa: 'მაგ: Player Series',
        placeholderEn: 'e.g. Player Series',
        maxLength: 60,
      },
    ],
  },

  'book': {
    ...COMMON_PRODUCT_BASE,
    categoryId: 'book',
    titleLabelKa: 'წიგნის / საკანცელარიო ნივთის სახელი',
    titleLabelEn: 'Book / Stationery Title',
    titlePlaceholderKa: 'მაგ: სისტემური ინჟინერიის სახელმძღვანელო',
    titlePlaceholderEn: 'e.g. Designing Data-Intensive Applications',
    fields: [
      {
        key: 'author',
        type: 'text',
        labelKa: 'ავტორი / გამომცემლობა',
        labelEn: 'Author / Publisher',
        placeholderKa: 'მაგ: მარტინ კლეპმანი / სულაკაური',
        placeholderEn: 'e.g. Martin Kleppmann / O’Reilly',
        maxLength: 80,
        showOnCard: true,
      },
      {
        key: 'bookLanguage',
        type: 'select',
        labelKa: 'ენა',
        labelEn: 'Language',
        showOnCard: true,
        options: [
          { value: 'ka', labelKa: 'ქართული', labelEn: 'Georgian' },
          { value: 'en', labelKa: 'ინგლისური', labelEn: 'English' },
          { value: 'ru', labelKa: 'რუსული', labelEn: 'Russian' },
          { value: 'other', labelKa: 'სხვა ენა', labelEn: 'Other' },
        ],
      },
      {
        key: 'coverType',
        type: 'select',
        labelKa: 'ყდა / ფორმატი',
        labelEn: 'Format / Cover',
        options: [
          { value: 'hardcover', labelKa: 'მაგარი ყდა', labelEn: 'Hardcover' },
          { value: 'paperback', labelKa: 'რბილი ყდა', labelEn: 'Paperback' },
          { value: 'stationery', labelKa: 'საკანცელარიო ნივთი', labelEn: 'Stationery' },
        ],
      },
    ],
  },

  'art': {
    ...COMMON_PRODUCT_BASE,
    categoryId: 'art',
    titleLabelKa: 'ნამუშევრის / საკოლექციო ნივთის სახელი',
    titleLabelEn: 'Artwork / Collectible Title',
    titlePlaceholderKa: 'მაგ: ზეთის ნახატი ტილოზე ან ვინტაჟური მონეტა',
    titlePlaceholderEn: 'e.g. Original Oil Painting on Canvas or Vintage Coin',
    fields: [
      {
        key: 'mediumOrTechnique',
        type: 'text',
        labelKa: 'ტექნიკა / მასალა',
        labelEn: 'Medium / Technique',
        placeholderKa: 'მაგ: ზეთი ტილოზე, აკრილი, ბრინჯაო',
        placeholderEn: 'e.g. Oil on canvas, Acrylic, Bronze',
        maxLength: 80,
        showOnCard: true,
      },
      {
        key: 'dimensions',
        type: 'text',
        labelKa: 'ზომები',
        labelEn: 'Dimensions',
        placeholderKa: 'მაგ: 80 x 60 სმ',
        placeholderEn: 'e.g. 80 x 60 cm',
        maxLength: 60,
        showOnCard: true,
      },
      {
        key: 'signedByAuthor',
        type: 'boolean',
        labelKa: 'ავტორის ხელმოწერით / ორიგინალი',
        labelEn: 'Signed by Artist / Original',
      },
    ],
  },

  'hunting': {
    ...COMMON_PRODUCT_BASE,
    categoryId: 'hunting',
    titleLabelKa: 'ნადირობისა და თევზაობის ნივთის სახელი',
    titleLabelEn: 'Hunting & Fishing Gear Title',
    titlePlaceholderKa: 'მაგ: Shimano სათევზაო ჯოხი ან სამთო კარავი',
    titlePlaceholderEn: 'e.g. Shimano Spinning Rod or Thermal Binoculars',
    fields: [
      {
        key: 'gearType',
        type: 'text',
        labelKa: 'აღჭურვილობის ტიპი',
        labelEn: 'Gear Type',
        placeholderKa: 'მაგ: ანკესი, ოპტიკა, ტურისტული კარავი',
        placeholderEn: 'e.g. Fishing Rod, Optics, Camping Tent',
        maxLength: 70,
        showOnCard: true,
      },
      {
        key: 'brand',
        type: 'text',
        labelKa: 'ბრენდი',
        labelEn: 'Brand',
        placeholderKa: 'მაგ: Shimano, Daiwa, Garmin',
        placeholderEn: 'e.g. Shimano, Daiwa, Garmin',
        maxLength: 50,
      },
      {
        key: 'caliberOrSpec',
        type: 'text',
        labelKa: 'სპეციფიკაცია / ზომა',
        labelEn: 'Spec / Size',
        placeholderKa: 'მაგ: 2.7მ / 10-30გ',
        placeholderEn: 'e.g. 2.7m / 10-30g',
        maxLength: 60,
        showOnCard: true,
      },
    ],
  },

  'newyear': {
    ...COMMON_PRODUCT_BASE,
    categoryId: 'newyear',
    titleLabelKa: 'საახალწლო პროდუქტის სახელი',
    titleLabelEn: 'New Year Product Title',
    titlePlaceholderKa: 'მაგ: ნაძვის ხე 2.1მ LED განათებით',
    titlePlaceholderEn: 'e.g. 2.1m Christmas Tree with Warm LED Lights',
    fields: [
      {
        key: 'itemType',
        type: 'text',
        labelKa: 'პროდუქტის ტიპი',
        labelEn: 'Item Type',
        placeholderKa: 'მაგ: ნაძვის ხე, განათება, დეკორი',
        placeholderEn: 'e.g. Tree, LED Garland, Ornament Set',
        maxLength: 70,
        showOnCard: true,
      },
      {
        key: 'dimensionsOrSetSize',
        type: 'text',
        labelKa: 'ზომა / კომპლექტაცია',
        labelEn: 'Size / Set Count',
        placeholderKa: 'მაგ: 210 სმ / 36 ცალი',
        placeholderEn: 'e.g. 210 cm / 36-piece set',
        maxLength: 60,
        showOnCard: true,
      },
    ],
  },
};

const FALLBACK_BY_TYPE: Record<ListingType, CategoryFormSchema> = {
  product: {
    ...COMMON_PRODUCT_BASE,
    categoryId: 'product-default',
    fields: [],
  },
  service: {
    ...COMMON_SERVICE_BASE,
    categoryId: 'service-default',
    locationMode: 'flexible',
    fields: [],
  },
  project: {
    ...COMMON_PROJECT_BASE,
    categoryId: 'project-default',
    locationMode: 'flexible',
    fields: [],
  },
};

export const getCategoryFormSchema = (
  listingType?: string | null,
  category?: string | null
): CategoryFormSchema => {
  const cat = (category || '').trim();
  if (cat && CATEGORY_SCHEMAS[cat]) {
    return CATEGORY_SCHEMAS[cat];
  }
  const resolvedType = inferListingType(cat, listingType);
  return FALLBACK_BY_TYPE[resolvedType];
};

export const getDefaultIsRemoteForSchema = (schema: CategoryFormSchema): boolean => {
  return schema.locationMode === 'remote';
};

export const filterAttributesForSchema = (
  schema: CategoryFormSchema,
  rawAttributes?: Record<string, any> | null
): Record<string, string | number | boolean> => {
  if (!rawAttributes || typeof rawAttributes !== 'object') {
    return {};
  }
  const allowedKeys = new Set(schema.fields.map(f => f.key));
  const next: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(rawAttributes)) {
    if (allowedKeys.has(k) && v !== undefined && v !== null) {
      next[k] = v;
    }
  }
  return next;
};

export const sanitizeListingAttributes = (
  listingType?: string | null,
  category?: string | null,
  rawAttributes?: Record<string, any> | null
): Record<string, string | number | boolean> => {
  if (!rawAttributes || typeof rawAttributes !== 'object') {
    return {};
  }
  const schema = getCategoryFormSchema(listingType, category);
  const sanitized: Record<string, string | number | boolean> = {};

  for (const field of schema.fields) {
    const rawVal = rawAttributes[field.key];
    if (rawVal === undefined || rawVal === null) continue;

    if (field.type === 'boolean') {
      if (rawVal === true || rawVal === 'true') {
        sanitized[field.key] = true;
      }
      continue;
    }

    if (field.type === 'number') {
      const strVal = typeof rawVal === 'number' ? String(rawVal) : String(rawVal).trim().replace(',', '.');
      if (!strVal) continue;
      const numVal = Number(strVal);
      if (!Number.isFinite(numVal)) continue;
      if (typeof field.min === 'number' && numVal < field.min) continue;
      if (typeof field.max === 'number' && numVal > field.max) continue;
      sanitized[field.key] = numVal;
      continue;
    }

    if (field.type === 'select') {
      const strVal = String(rawVal).trim();
      if (!strVal) continue;
      const validValues = new Set((field.options || []).map(o => o.value));
      if (validValues.size === 0 || validValues.has(strVal)) {
        sanitized[field.key] = strVal;
      }
      continue;
    }

    if (field.type === 'url') {
      const strVal = String(rawVal).trim();
      if (!strVal) continue;
      if (isSafeExternalUrl(strVal)) {
        sanitized[field.key] = strVal.slice(0, field.maxLength || 300);
      }
      continue;
    }

    // 'text'
    const strVal = String(rawVal).trim();
    if (!strVal) continue;
    sanitized[field.key] = strVal.slice(0, field.maxLength || 160);
  }

  return sanitized;
};

export const validateSchemaAttributes = (
  schema: CategoryFormSchema,
  rawAttributes: Record<string, any> | null | undefined,
  language: string
): AttributeValidationResult => {
  const isKa = language === 'ka';
  const attrs = rawAttributes && typeof rawAttributes === 'object' ? rawAttributes : {};
  const errors: Record<string, string> = {};

  for (const field of schema.fields) {
    const rawVal = attrs[field.key];
    const strVal = rawVal === undefined || rawVal === null ? '' : String(rawVal).trim();
    const fieldLabel = isKa ? field.labelKa : field.labelEn;

    if (field.required) {
      if (field.type === 'boolean') {
        if (rawVal !== true) {
          errors[field.key] = isKa
            ? `გთხოვთ მონიშნოთ: ${fieldLabel}`
            : `Please confirm: ${fieldLabel}`;
          continue;
        }
      } else if (!strVal) {
        errors[field.key] = isKa
          ? `შეავსეთ სავალდებულო ველი: ${fieldLabel}`
          : `${fieldLabel} is required`;
        continue;
      }
    }

    if (!strVal) continue;

    if (field.type === 'number') {
      const normalized = strVal.replace(',', '.');
      const num = Number(normalized);
      if (!Number.isFinite(num)) {
        errors[field.key] = isKa
          ? `შეიყვანეთ სწორი რიცხვი (${fieldLabel})`
          : `Enter a valid number for ${fieldLabel}`;
        continue;
      }
      if (typeof field.min === 'number' && num < field.min) {
        errors[field.key] = isKa
          ? `მნიშვნელობა არ უნდა იყოს ${field.min}-ზე ნაკლები`
          : `Must be at least ${field.min}`;
        continue;
      }
      if (typeof field.max === 'number' && num > field.max) {
        errors[field.key] = isKa
          ? `მნიშვნელობა არ უნდა აღემატებოდეს ${field.max}-ს`
          : `Must not exceed ${field.max}`;
        continue;
      }
    }

    if (field.type === 'url') {
      if (!isSafeExternalUrl(strVal)) {
        errors[field.key] = isKa
          ? 'შეიყვანეთ სწორი ბმული (http:// ან https://)'
          : 'Enter a valid URL starting with http:// or https://';
        continue;
      }
    }

    if (field.type === 'select' && field.options && field.options.length > 0) {
      if (!field.options.some(opt => opt.value === strVal)) {
        errors[field.key] = isKa
          ? `აირჩიეთ სწორი მნიშვნელობა (${fieldLabel})`
          : `Select a valid option for ${fieldLabel}`;
      }
    }
  }

  const errorMessages = Object.values(errors);
  return {
    valid: errorMessages.length === 0,
    errors,
    firstErrorMessage: errorMessages[0],
  };
};

const formatCompactNumber = (num: number): string => {
  if (!Number.isFinite(num)) return String(num);
  if (num >= 1_000_000) {
    const m = num / 1_000_000;
    return `${Number.isInteger(m) ? m : m.toFixed(1)}M`;
  }
  if (num >= 1_000) {
    const k = num / 1_000;
    return `${Number.isInteger(k) ? k : k.toFixed(1)}K`;
  }
  return num.toLocaleString('en-US');
};

export const formatFieldDisplayValue = (
  field: DynamicFieldSchema,
  rawVal: string | number | boolean,
  language: string,
  compact: boolean = false
): string => {
  const isKa = language === 'ka';

  if (field.type === 'boolean') {
    return rawVal === true ? (isKa ? 'დიახ' : 'Yes') : (isKa ? 'არა' : 'No');
  }

  if (field.type === 'select' && field.options) {
    const found = field.options.find(opt => opt.value === String(rawVal));
    if (found) {
      return isKa ? found.labelKa : found.labelEn;
    }
  }

  if (field.type === 'number') {
    const num = typeof rawVal === 'number' ? rawVal : Number(rawVal);
    if (Number.isFinite(num)) {
      const formatted = compact ? formatCompactNumber(num) : num.toLocaleString('en-US');
      return field.suffix ? `${formatted} ${field.suffix}` : formatted;
    }
  }

  const str = String(rawVal).trim();
  return field.suffix && !str.includes(field.suffix) ? `${str} ${field.suffix}` : str;
};

export const getFormattedListingAttributes = (
  listing?: Partial<Listing> | null,
  language: string = 'en'
): FormattedListingAttribute[] => {
  if (!listing || !listing.attributes || typeof listing.attributes !== 'object') {
    return [];
  }

  const isKa = language === 'ka';
  const schema = getCategoryFormSchema(listing.listingType, listing.category);
  const result: FormattedListingAttribute[] = [];

  for (const field of schema.fields) {
    const rawVal = listing.attributes[field.key];
    if (rawVal === undefined || rawVal === null) continue;
    if (field.type === 'boolean' && rawVal !== true) continue;
    if (typeof rawVal === 'string' && !rawVal.trim()) continue;
    if (field.type === 'url' && !isSafeExternalUrl(rawVal)) continue;

    result.push({
      key: field.key,
      label: isKa ? field.labelKa : field.labelEn,
      value: formatFieldDisplayValue(field, rawVal, language, false),
      type: field.type,
      isSafeUrl: field.type === 'url' && isSafeExternalUrl(rawVal),
    });
  }

  return result;
};

export const getCardAttributeHighlights = (
  listing?: Partial<Listing> | null,
  language: string = 'en',
  maxItems: number = 2
): string[] => {
  if (!listing || !listing.attributes || typeof listing.attributes !== 'object') {
    return [];
  }

  const isKa = language === 'ka';
  const schema = getCategoryFormSchema(listing.listingType, listing.category);
  const highlights: string[] = [];

  for (const field of schema.fields) {
    if (!field.showOnCard) continue;
    const rawVal = listing.attributes[field.key];
    if (rawVal === undefined || rawVal === null) continue;
    if (field.type === 'boolean' && rawVal !== true) continue;
    if (typeof rawVal === 'string' && !rawVal.trim()) continue;

    let display = formatFieldDisplayValue(field, rawVal, language, true);
    if (field.key === 'subscribersCount') {
      display = `${display} ${isKa ? 'გამომწერი' : 'subs'}`;
    } else if (field.key === 'followersCount') {
      display = `${display} ${isKa ? 'ფოლოუერი' : 'followers'}`;
    }

    highlights.push(display);
    if (highlights.length >= maxItems) break;
  }

  return highlights;
};

export const isEffectiveRemoteListing = (listing?: Partial<Listing> | null): boolean => {
  if (!listing) return false;
  if (typeof listing.isRemote === 'boolean') return listing.isRemote;
  return (
    (listing.country || '').trim().toUpperCase() === 'GLOBAL' &&
    (listing.city || '').trim().toLowerCase() === 'online'
  );
};

export interface FormData {
  // Step 1: 基本情報・インフラ
  companyName: string;
  phone: string;
  address: string;
  deadline: string;
  deliveryFormat: string;
  hasServer: boolean | null;
  hasDomain: boolean | null;
  existingDomain: string;
  ftpDetails: string;

  // Step 2: プロジェクトの目的
  siteType: string;
  background: string;
  purpose: string;
  mustConvey: string;

  // Step 3: ブランド＆トーン
  targetAudience: string;
  brandPersonality: string;
  desiredEmotion: string;
  ngDesign: string;

  // Step 4: デザインイメージ
  designKeywords: string[];
  themeColors: string[];
  competitors: string;

  // Step 5: 機能・素材
  pages: string;
  features: string[];
  snsLink: string;
  responsive: string[];
  browsers: string;
  assets: string;
}

export const initialFormData: FormData = {
  companyName: '',
  phone: '',
  address: '',
  deadline: '',
  deliveryFormat: '',
  hasServer: null,
  hasDomain: null,
  existingDomain: '',
  ftpDetails: '',
  siteType: '',
  background: '',
  purpose: '',
  mustConvey: '',
  targetAudience: '',
  brandPersonality: '',
  desiredEmotion: '',
  ngDesign: '',
  designKeywords: [],
  themeColors: [],
  competitors: '',
  pages: '',
  features: [],
  snsLink: '',
  responsive: [],
  browsers: 'Safari, Chrome, Edge',
  assets: ''
};

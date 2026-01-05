
import { SubscriptionPlan, QuestionType } from "./types";

export const APP_NAME = "RKS QP Maker";

export const CBSE_CLASSES = ['VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

export const CBSE_SUBJECTS: Record<string, string[]> = {
  'VI': ['Mathematics', 'Science', 'Social Science', 'English', 'Hindi', 'Punjabi', 'Sanskrit'],
  'VII': ['Mathematics', 'Science', 'Social Science', 'English', 'Hindi', 'Punjabi', 'Sanskrit'],
  'VIII': ['Mathematics', 'Science', 'Social Science', 'English', 'Hindi', 'Punjabi', 'Sanskrit'],
  'IX': ['Mathematics', 'Science', 'Social Science', 'English', 'Hindi', 'Punjabi', 'Sanskrit'],
  'X': ['Mathematics', 'Science', 'Social Science', 'English', 'Hindi', 'Punjabi', 'Sanskrit'],
  'XI': ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'Accountancy', 'Economics', 'English', 'Computer Science', 'Hindi', 'Punjabi', 'Sanskrit'],
  'XII': ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'Accountancy', 'Economics', 'English', 'Computer Science', 'Hindi', 'Punjabi', 'Sanskrit'],
};

export const QUESTION_TYPES = Object.values(QuestionType);

export const PRICING = {
  [SubscriptionPlan.FREE]: { price: 0, papers: 1, label: 'Free Trial', validityDays: 365 },
  [SubscriptionPlan.STARTER]: { price: 149, papers: 5, label: 'Starter Plan', validityDays: 30 },
  [SubscriptionPlan.PROFESSIONAL]: { price: 299, papers: 10, label: 'Professional Plan', validityDays: 60 },
  [SubscriptionPlan.PREMIUM]: { price: 499, papers: 18, label: 'Premium Plan', validityDays: 90 },
};

export const UPI_QR_IMAGE = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=upi://pay?pa=mock-merchant@upi&pn=CBSEGenerator&am=0&cu=INR";

// Razorpay Key
export const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID || '';

export const MOCK_ADMIN_EMAIL = "admin@cbse.com";
export const MOCK_TEACHER_EMAIL = "teacher@cbse.com";

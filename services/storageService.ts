
import { User, QuestionPaper, PaymentRequest, UserRole, SubscriptionStatus, SubscriptionPlan, SamplePattern, QuestionType, ContentPage } from "../types";
import { MOCK_ADMIN_EMAIL, PRICING, CBSE_SUBJECTS } from "../constants";
import { auth, db, isMock } from "../firebaseConfig";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
  deleteDoc,
  updateDoc
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  User as FirebaseUser
} from "firebase/auth";

// Collections
const USERS_COL = 'users';
const PAPERS_COL = 'papers';
const REQUESTS_COL = 'requests';
const PATTERNS_COL = 'patterns';
const CONFIG_COL = 'config';
const CONTENT_COL = 'content';

export const StorageService = {
  // --- Auth Wrappers ---
  login: async (email: string, password: string): Promise<User> => {
    if (isMock) {
      return {
        name: "Mock User",
        email: email,
        role: UserRole.TEACHER,
        credits: 100,
        subscriptionPlan: SubscriptionPlan.PREMIUM,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        schoolName: "Mock School",
        mobile: "1234567890",
        city: "Mock City",
        state: "Mock State"
      };
    }
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = await StorageService.getUser(userCredential.user.email!);
    if (!user) throw new Error("User profile not found");
    return user;
  },

  logout: async () => {
    await signOut(auth);
  },



  // --- Question Types Management ---
  getQuestionTypes: async (): Promise<string[]> => {
    if (isMock) return Object.values(QuestionType);
    const docRef = doc(db, CONFIG_COL, 'qtypes');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      return Array.isArray(data?.types) ? data.types : Object.values(QuestionType);
    }

    // Default
    const defaultTypes = Object.values(QuestionType);
    await setDoc(docRef, { types: defaultTypes });
    return defaultTypes;
  },

  addQuestionType: async (type: string) => {
    const types = await StorageService.getQuestionTypes();
    if (types.includes(type)) throw new Error("Question Type already exists");
    types.push(type);
    await setDoc(doc(db, CONFIG_COL, 'qtypes'), { types });
  },

  deleteQuestionType: async (type: string) => {
    let types = await StorageService.getQuestionTypes();
    types = types.filter(t => t !== type);
    await setDoc(doc(db, CONFIG_COL, 'qtypes'), { types });
  },

  // --- Curriculum Config (Classes & Subjects) ---
  getConfig: async (): Promise<Record<string, string[]>> => {
    if (isMock) return CBSE_SUBJECTS;
    const docRef = doc(db, CONFIG_COL, 'curriculum');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      return data ? (data as Record<string, string[]>) : CBSE_SUBJECTS;
    }

    // Default
    await setDoc(docRef, CBSE_SUBJECTS);
    return CBSE_SUBJECTS;
  },

  addClass: async (className: string) => {
    const config = await StorageService.getConfig();
    if (config[className]) throw new Error("Class already exists");
    config[className] = [];
    await setDoc(doc(db, CONFIG_COL, 'curriculum'), config);
  },

  deleteClass: async (className: string) => {
    const config = await StorageService.getConfig();
    delete config[className];
    await setDoc(doc(db, CONFIG_COL, 'curriculum'), config);
  },

  addSubject: async (className: string, subject: string) => {
    const config = await StorageService.getConfig();
    if (!config[className]) throw new Error("Class does not exist");
    if (config[className].includes(subject)) throw new Error("Subject already exists in this class");

    config[className].push(subject);
    await setDoc(doc(db, CONFIG_COL, 'curriculum'), config);
  },

  deleteSubject: async (className: string, subject: string) => {
    const config = await StorageService.getConfig();
    if (config[className]) {
      config[className] = config[className].filter(s => s !== subject);
      await setDoc(doc(db, CONFIG_COL, 'curriculum'), config);
    }
  },

  // --- Users ---
  getUser: async (email: string): Promise<User | undefined> => {
    if (isMock) {
      return {
        name: "Mock User",
        email: email,
        role: UserRole.TEACHER,
        credits: 100,
        subscriptionPlan: SubscriptionPlan.PREMIUM,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        schoolName: "Mock School",
        mobile: "1234567890",
        city: "Mock City",
        state: "Mock State"
      };
    }
    const docRef = doc(db, USERS_COL, email);
    const snap = await getDoc(docRef);
    return snap.exists() ? snap.data() as User : undefined;
  },

  getAllUsers: async (): Promise<User[]> => {
    const snapshot = await getDocs(collection(db, USERS_COL));
    return snapshot.docs.map(d => d.data() as User);
  },

  updateUser: async (updatedUser: User, originalEmail?: string) => {
    if (isMock) {
      console.log("Mock update user", updatedUser);
      return;
    }
    const email = originalEmail || updatedUser.email;
    await setDoc(doc(db, USERS_COL, email), updatedUser);
  },

  createUser: async (newUser: User) => {
    if (isMock) {
      console.log("Mock create user", newUser);
      return;
    }
    // Create in Firebase Auth
    await createUserWithEmailAndPassword(auth, newUser.email, newUser.password!);

    // Enforce default 1 free credit if not specified by admin
    if (newUser.role === UserRole.TEACHER && !newUser.credits) {
      newUser.credits = 1;
      newUser.subscriptionPlan = SubscriptionPlan.FREE;
      newUser.subscriptionStatus = SubscriptionStatus.ACTIVE;
    }

    // Save Profile in Firestore
    await setDoc(doc(db, USERS_COL, newUser.email), newUser);
  },

  deleteUser: async (email: string) => {
    await deleteDoc(doc(db, USERS_COL, email));
    // Note: Cannot delete from Auth easily without Admin SDK, but removing from Firestore prevents login via app logic if we check DB
  },

  // --- Papers ---
  savePaper: async (paper: QuestionPaper) => {
    if (isMock) {
      console.log("Mock save paper", paper);
      return;
    }
    const docRef = doc(db, PAPERS_COL, paper.id);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      await updateDoc(docRef, { ...paper });
    } else {
      const newPaper = {
        ...paper,
        visibleToTeacher: true,
        visibleToAdmin: true,
        editCount: 0,
        downloadCount: 0
      };
      await setDoc(docRef, newPaper);
    }
  },

  deletePapersByUser: async (email: string) => {
    if (isMock) return;
    const q = query(collection(db, 'papers'), where("userEmail", "==", email));
    const snapshot = await getDocs(q);
    const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
    await Promise.all(deletePromises);
  },

  // --- Tickets ---
  createTicket: async (ticket: any) => {
    if (isMock) return;
    await setDoc(doc(db, 'tickets', ticket.id), ticket);
  },

  getTicketsByUser: async (email: string): Promise<any[]> => {
    if (isMock) return [];
    const q = query(collection(db, 'tickets'), where("userEmail", "==", email));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => d.data());
  },

  getAllTickets: async (): Promise<any[]> => {
    if (isMock) return [];
    const snapshot = await getDocs(collection(db, 'tickets'));
    return snapshot.docs.map(d => d.data());
  },

  updateTicket: async (ticket: any) => {
    if (isMock) return;
    await setDoc(doc(db, 'tickets', ticket.id), ticket);
  },

  // --- CMS Content Management ---
  getAllContentPages: async (): Promise<ContentPage[]> => {
    const snapshot = await getDocs(collection(db, CONTENT_COL));
    return snapshot.docs.map(d => d.data() as ContentPage);
  },

  getPageContent: async (id: string): Promise<ContentPage | undefined> => {
    if (isMock) return { id, title: "Mock Page", content: "That is mock content.", lastUpdated: new Date().toISOString() };
    const docRef = doc(db, CONTENT_COL, id);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      return snap.data() as ContentPage;
    }

    // Default Content for Play Store Policy compliance (High Quality)
    const defaultContent: Record<string, any> = {
      'privacy': {
        title: "Privacy Policy",
        content: "Effective Date: January 1, 2026\n\n1. Information Collection\nWe collect information you provide directly to us, such as when you create an account, subscribe, or contact support. This includes your name, email address, and payment information logic (handled securely by Razorpay).\n\n2. Use of Information\nWe use your information to provide, maintain, and improve our services, specifically to generate question papers and manage your subscription.\n\n3. Data Sharing\nWe do not share your personal data with third parties except as necessary to provide the service (e.g., Firebase for hosting, Razorpay for payments).\n\n4. Data Security\nWe implement reasonable security measures to protect your information. However, no security system is impenetrable."
      },
      'terms': {
        title: "Terms & Conditions",
        content: "1. Acceptance of Terms\nBy accessing and using this app, you accept and agree to be bound by these Terms and Conditions.\n\n2. User Accounts\nYou are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized use.\n\n3. Subscription & Payments\nPaid plans offer additional features. Payments are final and non-refundable except as per our Refund Policy.\n\n4. Content Usage\nThe question papers generated are for educational use. You retain rights to the specific compilations you create, but the underlying questions remain part of our database."
      },
      'refund': {
        title: "Refund Policy",
        content: "1. No Refunds Policy\nGenerally, all sales are final. We do not offer refunds for partial use or if you change your mind.\n\n2. Exceptions\nRefunds may be considered in cases of:\n- Double deduction of payment due to technical error.\n- Service unavailability for a prolonged period (>48 hours).\n\n3. Contacting Support\nIf you believe you have a valid claim for a refund, please contact our support team via the 'Contact Us' section."
      },
      'about': {
        title: "About Us",
        content: "RKS Question Paper Maker is a premier tool designed to empower teachers.\n\nOur Mission:\nTo save teachers' time by automating the tedious task of setting question papers, allowing them to focus more on teaching and student interaction.\n\nFeatures:\n- AI-Powered Question Generation\n- CBSE Aligned Blueprints\n- Custom Branding for Schools\n\nContact: support@cbse-maker.com"
      }
    };

    if (defaultContent[id]) {
      return {
        id,
        title: defaultContent[id].title,
        content: defaultContent[id].content,
        lastUpdated: new Date().toISOString()
      };
    }

    return undefined;
  },

  // Helper to just get defaults (for Admin Reset)
  getDefaultContentOrFetch: async (id: string): Promise<ContentPage | undefined> => {
    // Re-using the logic above, but forcing default return if passed a specific flag,
    // or just copy-pasting the default object here for simplicity/safety to ensure we get the FRESH copy.

    const defaultContent: Record<string, any> = {
      'privacy': {
        title: "Privacy Policy",
        content: "Effective Date: January 1, 2026\n\n1. Information Collection\nWe collect information you provide directly to us, such as when you create an account, subscribe, or contact support. This includes your name, email address, and payment information logic (handled securely by Razorpay).\n\n2. Use of Information\nWe use your information to provide, maintain, and improve our services, specifically to generate question papers and manage your subscription.\n\n3. Data Sharing\nWe do not share your personal data with third parties except as necessary to provide the service (e.g., Firebase for hosting, Razorpay for payments).\n\n4. Data Security\nWe implement reasonable security measures to protect your information. However, no security system is impenetrable."
      },
      'terms': {
        title: "Terms & Conditions",
        content: "1. Acceptance of Terms\nBy accessing and using this app, you accept and agree to be bound by these Terms and Conditions.\n\n2. User Accounts\nYou are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized use.\n\n3. Subscription & Payments\nPaid plans offer additional features. Payments are final and non-refundable except as per our Refund Policy.\n\n4. Content Usage\nThe question papers generated are for educational use. You retain rights to the specific compilations you create, but the underlying questions remain part of our database."
      },
      'refund': {
        title: "Refund Policy",
        content: "1. No Refunds Policy\nGenerally, all sales are final. We do not offer refunds for partial use or if you change your mind.\n\n2. Exceptions\nRefunds may be considered in cases of:\n- Double deduction of payment due to technical error.\n- Service unavailability for a prolonged period (>48 hours).\n\n3. Contacting Support\nIf you believe you have a valid claim for a refund, please contact our support team via the 'Contact Us' section."
      },
      'about': {
        title: "About Us",
        content: "RKS Question Paper Maker is a premier tool designed to empower teachers.\n\nOur Mission:\nTo save teachers' time by automating the tedious task of setting question papers, allowing them to focus more on teaching and student interaction.\n\nFeatures:\n- AI-Powered Question Generation\n- CBSE Aligned Blueprints\n- Custom Branding for Schools\n\nContact: support@cbse-maker.com"
      }
    };

    if (defaultContent[id]) {
      return {
        id,
        title: defaultContent[id].title,
        content: defaultContent[id].content,
        lastUpdated: new Date().toISOString()
      };
    }
    return undefined;
  },

  getPapersByUser: async (email: string): Promise<QuestionPaper[]> => {
    if (isMock) return [];
    const q = query(collection(db, PAPERS_COL), where("createdBy", "==", email));
    const snapshot = await getDocs(q);
    const papers = snapshot.docs.map(d => d.data() as QuestionPaper);
    return papers.filter(p => p.visibleToTeacher !== false);
  },

  getAllPapers: async (): Promise<QuestionPaper[]> => {
    const snapshot = await getDocs(collection(db, PAPERS_COL));
    const papers = snapshot.docs.map(d => d.data() as QuestionPaper);
    return papers.filter(p => p.visibleToAdmin !== false);
  },

  deletePaper: async (id: string, target: 'TEACHER' | 'ADMIN' | 'PERMANENT' = 'PERMANENT') => {
    if (isMock) {
      console.log("Mock delete paper", id);
      return;
    }
    const docRef = doc(db, PAPERS_COL, id);

    if (target === 'PERMANENT') {
      await deleteDoc(docRef);
    } else {
      if (target === 'TEACHER') {
        await updateDoc(docRef, { visibleToTeacher: false });
      } else if (target === 'ADMIN') {
        await updateDoc(docRef, { visibleToAdmin: false });
      }
    }
  },

  // --- Sample Patterns ---
  saveSamplePattern: async (pattern: SamplePattern) => {
    // Generate a unique ID based on class/subject or random
    const id = `${pattern.classNum}_${pattern.subject}`.replace(/\s+/g, '_');
    await setDoc(doc(db, PATTERNS_COL, id), pattern);
  },

  getSamplePattern: async (classNum: string, subject: string): Promise<SamplePattern | undefined> => {
    const id = `${classNum}_${subject}`.replace(/\s+/g, '_');
    const docRef = doc(db, PATTERNS_COL, id);
    const snap = await getDoc(docRef);
    return snap.exists() ? snap.data() as SamplePattern : undefined;
  },

  getAdminPattern: async (classNum: string, subject: string): Promise<QuestionPaper | undefined> => {
    // This is complex in Firestore without composite index. 
    // Simplified: Get all papers for class/subject, then filter by admin role.
    // Better: Store "role" in paper or trust the "createdBy" check.

    const q = query(
      collection(db, PAPERS_COL),
      where("classNum", "==", classNum),
      where("subject", "==", subject)
    );
    const snapshot = await getDocs(q);
    const papers = snapshot.docs.map(d => d.data() as QuestionPaper);

    // We need to know which emails are admins. 
    // Optimization: Just check if the paper was created by MOCK_ADMIN_EMAIL or check user role.
    // For now, let's fetch all users to find admins (inefficient but works for small app)
    const users = await StorageService.getAllUsers();
    const adminEmails = users.filter(u => u.role === UserRole.ADMIN).map(u => u.email);

    const adminPapers = papers.filter(p =>
      adminEmails.includes(p.createdBy) &&
      p.visibleToAdmin !== false
    );

    return adminPapers.length > 0 ? adminPapers[adminPapers.length - 1] : undefined;
  },

  getStyleContext: async (classNum: string, subject: string): Promise<{
    text: string,
    attachment?: { data: string, mimeType: string },
    syllabusAttachment?: { data: string, mimeType: string }
  }> => {
    const pattern = await StorageService.getSamplePattern(classNum, subject);
    if (pattern) {
      let text = "";
      if (pattern.content.trim().length > 0) {
        text += `Use the following sample paper text as a strict style and difficulty guide:\n\n${pattern.content}\n`;
      }
      if (pattern.attachment) {
        text += `\nRefer to the attached Sample Paper document for the exact question style, difficulty, and format. Mimic it closely.`;
      }
      if (pattern.syllabusAttachment) {
        text += `\nRefer to the attached Syllabus/Blueprint document. Ensure all generated questions strictly fall within the topics and scope defined in this syllabus.`;
      }

      return {
        text,
        attachment: pattern.attachment,
        syllabusAttachment: pattern.syllabusAttachment
      };
    }

    if (isMock) return { text: "" };
    // Fallback
    const adminPaper = await StorageService.getAdminPattern(classNum, subject);
    if (adminPaper) {
      const sampleQs = adminPaper.sections.flatMap(s => s.questions).slice(0, 10);
      const text = `Follow the style of these previous questions generated by admin:\n` +
        sampleQs.map(q => `- (${q.type}) ${q.text}`).join('\n');
      return { text };
    }

    return { text: "" };
  },

  // --- Subscriptions ---
  async recordSubscriptionPayment(user: User, plan: SubscriptionPlan, paymentId: string, amount: number) {
    try {
      // 1. Update User Status
      const userRef = doc(db, USERS_COL, user.email);
      const now = new Date();
      const nowIso = now.toISOString();

      // Calculate expiry based on plan validity
      const validityDays = PRICING[plan].validityDays || 30;
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + validityDays);

      const updatedUser: Partial<User> = {
        subscriptionPlan: plan,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        // Reset credits based on plan
        credits: PRICING[plan].papers,
        subscriptionExpiryDate: expiryDate.toISOString()
      };
      await updateDoc(userRef, updatedUser);

      // 2. Record Transaction in Requests (for Admin Revenue)
      // We start ID with 'pay_' to distinguish from manual requests
      const reqId = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const request: PaymentRequest = {
        id: reqId,
        userEmail: user.email,
        plan: plan,
        amount: amount,
        proofUrl: paymentId, // Storing Payment ID in proofUrl field for reference
        status: SubscriptionStatus.ACTIVE,
        date: nowIso
      };
      await setDoc(doc(db, REQUESTS_COL, reqId), request);

      return true;
    } catch (error) {
      console.error("Error recording payment:", error);
      throw error;
    }
  },

  createPaymentRequest: async (email: string, plan: SubscriptionPlan, proofUrl: string) => {
    if (isMock) {
      console.log("Mock create payment request", { email, plan, proofUrl });
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      return;
    }
    const newReq: PaymentRequest = {
      id: Date.now().toString(),
      userEmail: email,
      plan,
      amount: PRICING[plan].price,
      proofUrl,
      status: SubscriptionStatus.PENDING,
      date: new Date().toISOString()
    };
    await setDoc(doc(db, REQUESTS_COL, newReq.id), newReq);

    const user = await StorageService.getUser(email);
    if (user) {
      user.subscriptionStatus = SubscriptionStatus.PENDING;
      await StorageService.updateUser(user);
    }
  },

  getAllRequests: async (): Promise<PaymentRequest[]> => {
    const snapshot = await getDocs(collection(db, REQUESTS_COL));
    return snapshot.docs.map(d => d.data() as PaymentRequest);
  },

  processRequest: async (reqId: string, approved: boolean) => {
    const docRef = doc(db, REQUESTS_COL, reqId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return;

    const request = snap.data() as PaymentRequest;
    request.status = approved ? SubscriptionStatus.ACTIVE : SubscriptionStatus.REJECTED;
    await setDoc(docRef, request);

    if (approved) {
      const user = await StorageService.getUser(request.userEmail);
      if (user) {
        user.subscriptionPlan = request.plan;
        user.subscriptionStatus = SubscriptionStatus.ACTIVE;
        user.credits += PRICING[request.plan].papers;

        const now = new Date();
        if (request.plan === SubscriptionPlan.STARTER) {
          now.setDate(now.getDate() + 30);
        } else if (request.plan === SubscriptionPlan.PROFESSIONAL) {
          now.setDate(now.getDate() + 60);
        } else if (request.plan === SubscriptionPlan.PREMIUM) {
          now.setDate(now.getDate() + 180);
        }

        user.subscriptionExpiryDate = now.toISOString();

        await StorageService.updateUser(user);
      }
    } else {
      const user = await StorageService.getUser(request.userEmail);
      if (user) {
        user.subscriptionStatus = SubscriptionStatus.REJECTED;
        await StorageService.updateUser(user);
      }
    }
  }
};

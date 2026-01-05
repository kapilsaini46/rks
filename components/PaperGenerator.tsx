
import React, { useState, useEffect, useRef } from 'react';
import { QuestionPaper, Section, Question, QuestionType, UserRole, BlueprintItem, SubscriptionPlan } from '../types';
import { generateQuestionsWithAI, generateImageForQuestion } from '../services/geminiService';
import { StorageService } from '../services/storageService';
import Cropper from 'react-easy-crop';

const TRANSLATIONS: any = {
  Hindi: {
    schoolName: 'विद्यालय का नाम',
    examTitle: 'परीक्षा',
    subject: 'विषय',
    class: 'कक्षा',
    session: 'सत्र',
    time: 'समय',
    maxMarks: 'पूर्णांक',
    generalInstructions: 'सामान्य निर्देश',
    section: 'खंड',
    questionPrefix: 'प्र.',
    answerKey: 'उत्तर कुंजी',
    defaultInstructions: '1. सभी प्रश्न अनिवार्य हैं।\n2. प्रश्न पत्र में सभी खंडों के उत्तर देना अनिवार्य है।',
    sectionLabels: ['अ', 'ब', 'स', 'द', 'इ', 'फ']
  },
  Punjabi: {
    schoolName: 'ਸਕੂਲ ਦਾ ਨਾਮ',
    examTitle: 'ਪ੍ਰੀਖਿਆ',
    subject: 'ਵਿਸ਼ਾ',
    class: 'ਜਮਾਤ',
    session: 'ਸੈਸ਼ਨ',
    time: 'ਸਮਾਂ',
    maxMarks: 'ਕੁੱਲ ਅੰਕ',
    generalInstructions: 'ਆਮ ਨਿਰਦੇਸ਼',
    section: 'ਭਾਗ',
    questionPrefix: 'ਪ੍ਰ.',
    answerKey: 'ਉੱਤਰ ਕੁੰਜੀ',
    defaultInstructions: '1. ਸਾਰੇ ਪ੍ਰਸ਼ਨ ਲਾਜ਼ਮੀ ਹਨ।\n2. ਪ੍ਰਸ਼ਨ ਪੱਤਰ ਵਿੱਚ ਸਾਰੇ ਭਾਗਾਂ ਦੇ ਉੱਤਰ ਦੇਣਾ ਲਾਜ਼ਮੀ ਹੈ।',
    sectionLabels: ['ੳ', 'ਅ', 'ੲ', 'ਸ', 'ਹ', 'ਕ']
  },
  Sanskrit: {
    schoolName: 'विद्यालयस्य नाम',
    examTitle: 'परीक्षा',
    subject: 'विषयः',
    class: 'कक्षा',
    session: 'सत्रम्',
    time: 'समयः',
    maxMarks: 'पूर्णाङ्काः',
    generalInstructions: 'सामान्यनिर्देशाः',
    section: 'खण्डः',
    questionPrefix: 'प्र.',
    answerKey: 'उत्तरकुञ्जिका',
    defaultInstructions: '1. सर्वे प्रश्नाः अनिवर्याः सन्ति।\n2. प्रश्नपत्रे सर्वेषां खण्डानाम् उत्तराणि दातव्यानि।',
    sectionLabels: ['क', 'ख', 'ग', 'घ', 'ङ', 'च']
  },
  English: {
    schoolName: 'SCHOOL NAME',
    examTitle: 'EXAMINATION',
    subject: 'SUBJECT',
    class: 'CLASS',
    session: 'SESSION',
    time: 'TIME',
    maxMarks: 'MAX. MARKS',
    generalInstructions: 'General Instructions',
    section: 'SECTION',
    questionPrefix: '',
    answerKey: 'ANSWER KEY',
    defaultInstructions: '1. All questions are compulsory.\n2. The question paper consists of ...',
    sectionLabels: ['A', 'B', 'C', 'D', 'E', 'F']
  }
};

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.setAttribute('crossOrigin', 'anonymous')
    image.src = url
  })

async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
): Promise<string> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    return ''
  }

  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  )

  return canvas.toDataURL('image/jpeg');
}

interface Props {
  userEmail: string;
  existingPaper?: QuestionPaper;
  onClose: () => void;
  onSuccess: () => void;
  readOnly?: boolean;
  autoDownload?: 'paper' | 'key';
}

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

const cleanOptionText = (text: string): string => {
  if (!text) return "";
  return text.replace(/^(\([a-zA-Z0-9]+\)|[a-zA-Z0-9]+[.):]\s*)+/, '').trim();
};

const MathText: React.FC<{ text: string }> = ({ text }) => {
  const [parts, setParts] = useState<React.ReactNode[]>([]);
  const [katexLoaded, setKatexLoaded] = useState(false);

  useEffect(() => {
    // @ts-ignore
    if (typeof window.katex !== 'undefined') {
      setKatexLoaded(true);
      return;
    }
    const interval = setInterval(() => {
      // @ts-ignore
      if (typeof window.katex !== 'undefined') {
        setKatexLoaded(true);
        clearInterval(interval);
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!text) { setParts([]); return; }
    if (!katexLoaded) { setParts([<span key="loading" className="opacity-75 font-mono text-sm">{text}</span>]); return; }

    const segments = text.split(/(\$[^$]+\$)/g);
    const renderedParts = segments.map((part, index) => {
      if (part.startsWith('$') && part.endsWith('$')) {
        const math = part.slice(1, -1);
        try {
          // @ts-ignore
          const html = window.katex.renderToString(math, { throwOnError: false, output: 'html' });
          return <span key={index} dangerouslySetInnerHTML={{ __html: html }} />;
        } catch (e) {
          return <span key={index} className="text-red-500 font-mono text-xs">{part}</span>;
        }
      } else {
        return <span key={index}>{part}</span>;
      }
    });
    setParts(renderedParts);
  }, [text, katexLoaded]);

  return <span className="math-content inline-block max-w-full break-words">{parts.length > 0 ? parts : text}</span>;
};

const ResizableImage: React.FC<{
  src: string; initialWidth?: number; onResize: (width: number) => void; onRemove: () => void; readOnly?: boolean;
}> = ({ src, initialWidth = 50, onResize, onRemove, readOnly }) => {
  const [width, setWidth] = useState(initialWidth);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  useEffect(() => { setWidth(initialWidth); }, [initialWidth]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (readOnly) return;
    e.preventDefault();
    isDragging.current = true;
    const startX = e.clientX;
    const startWidth = containerRef.current?.offsetWidth || 0;
    const parentWidth = containerRef.current?.parentElement?.offsetWidth || 1;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging.current) return;
      const deltaX = moveEvent.clientX - startX;
      const newPixelWidth = startWidth + deltaX;
      const newPercent = Math.min(100, Math.max(10, (newPixelWidth / parentWidth) * 100));
      setWidth(newPercent);
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      onResize(width);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div ref={containerRef} className={`relative inline-block group/img ${readOnly ? '' : 'cursor-default'}`} style={{ width: `${width}%`, minWidth: '100px', maxWidth: '100%' }}>
      <img src={src} alt="Diagram" className="w-full h-auto border rounded-lg bg-white p-1 shadow-sm select-none pointer-events-none" />
      {!readOnly && (
        <>
          <button onClick={onRemove} className="absolute -top-2 -right-2 bg-white text-red-500 border border-red-100 w-8 h-8 rounded-full shadow-md flex items-center justify-center hover:bg-red-50 z-10"><i className="fas fa-times"></i></button>
          <div onMouseDown={handleMouseDown} className="absolute bottom-0 right-0 w-6 h-6 bg-blue-500 rounded-tl-lg cursor-nwse-resize flex items-center justify-center shadow-md hover:bg-blue-600 transition-colors z-10"><i className="fas fa-expand-alt text-white text-[10px]"></i></div>
        </>
      )}
    </div>
  );
};

const PaperGenerator: React.FC<Props> = ({ userEmail, existingPaper: propExistingPaper, onClose, onSuccess, readOnly: propReadOnly, autoDownload }) => {
  const [internalExistingPaper, setInternalExistingPaper] = useState<QuestionPaper | undefined>(propExistingPaper);

  // We need to fetch user async, but for initial render we might not have it.
  // However, PaperGenerator is usually rendered AFTER user is loaded in parent.
  // We'll fetch fresh user data to be sure about credits/plan.
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const loadUser = async () => {
      const u = await StorageService.getUser(userEmail);
      setUser(u);
    };
    loadUser();
  }, [userEmail]);

  const isAdmin = user?.role === UserRole.ADMIN;
  const isProfessional = user?.subscriptionPlan === SubscriptionPlan.PROFESSIONAL;
  const isFree = user?.subscriptionPlan === SubscriptionPlan.FREE;
  const isStarter = user?.subscriptionPlan === SubscriptionPlan.STARTER;

  const readOnly = (!(!propExistingPaper) && propReadOnly && !isAdmin);

  const [step, setStep] = useState(internalExistingPaper ? 3 : 1);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewMode, setPreviewMode] = useState<'paper' | 'key'>('paper');
  const [generatingImageId, setGeneratingImageId] = useState<string | null>(null);
  const [regeneratingQuestionId, setRegeneratingQuestionId] = useState<string | null>(null);

  // Cropping State
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [lastUploadedFile, setLastUploadedFile] = useState<{ sectionId: string, qId: string } | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  const [downloadedFiles, setDownloadedFiles] = useState<{ paper: boolean, key: boolean }>({
    paper: false,
    key: false
  });

  const [curriculumConfig, setCurriculumConfig] = useState<Record<string, string[]>>({});
  const [classList, setClassList] = useState<string[]>([]);
  const [availableQTypes, setAvailableQTypes] = useState<string[]>([]);

  useEffect(() => {
    const loadConfig = async () => {
      const config = await StorageService.getConfig();
      setCurriculumConfig(config);
      const classes = Object.keys(config);
      setClassList(classes);

      if (!internalExistingPaper && classes.length > 0 && !meta.classNum) {
        setMeta(prev => ({ ...prev, classNum: classes[0], subject: config[classes[0]]?.[0] || '' }));
      }

      const types = await StorageService.getQuestionTypes();
      setAvailableQTypes(types);
    };
    loadConfig();
  }, []);

  const [meta, setMeta] = useState(internalExistingPaper ? {
    title: internalExistingPaper.title,
    schoolName: internalExistingPaper.schoolName,
    classNum: internalExistingPaper.classNum,
    subject: internalExistingPaper.subject,
    session: internalExistingPaper.session || '2024-25',
    duration: internalExistingPaper.duration,
    maxMarks: internalExistingPaper.maxMarks,
    generalInstructions: internalExistingPaper.generalInstructions || ''
  } : {
    title: 'Half Yearly Examination',
    schoolName: user?.schoolName || 'Kendriya Vidyalaya',
    classNum: '',
    subject: '',
    session: '2024-25',
    duration: '3 Hours',
    maxMarks: 80,
    generalInstructions: '1. All questions are compulsory.\n2. The question paper consists of ...'
  });



  const getNormalizedLang = (s: string) => {
    if (!s) return 'English';
    const lower = s.toLowerCase();
    if (lower === 'hindi') return 'Hindi';
    if (lower === 'punjabi') return 'Punjabi';
    if (lower === 'sanskrit') return 'Sanskrit';
    return 'English';
  };
  const currentLang = getNormalizedLang(meta.subject);
  const t = TRANSLATIONS[currentLang];

  useEffect(() => {
    if (autoDownload) {
      const timer = setTimeout(() => {
        handleDownloadPDF(autoDownload);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [autoDownload]);

  useEffect(() => {
    if (meta.classNum && curriculumConfig[meta.classNum]) {
      const subjects = curriculumConfig[meta.classNum];
      if (Array.isArray(subjects) && !subjects.includes(meta.subject) && subjects.length > 0) {
        setMeta(prev => ({ ...prev, subject: subjects[0] }));
      }
    }
  }, [meta.classNum, curriculumConfig]);

  useEffect(() => {
    // defaults for English to check against
    const defaultEngTitle = 'Half Yearly Examination';
    const defaultEngSchool = 'Kendriya Vidyalaya';
    const defaultEngInstructions = '1. All questions are compulsory.\n2. The question paper consists of ...';

    // Helper to check if a string is roughly one of our known defaults (to avoid overwriting user custom text)
    const isDefaultTitle = (s: string) => {
      if (!s) return true;
      const lower = s.toLowerCase();
      return lower === defaultEngTitle.toLowerCase() ||
        lower === 'अर्धवार्षिक परीक्षा' ||
        lower === 'ਅਰਧ ਸਾਲਾਨਾ ਪ੍ਰੀਖਿਆ' ||
        lower === 'अर्धवार्षिकपरीक्षा' ||
        lower.includes('exam') || lower.includes('test') || lower.includes('परीक्षा');
    };
    const isDefaultSchool = (s: string) => {
      if (!s) return true;
      const lower = s.toLowerCase();
      return lower === defaultEngSchool.toLowerCase() ||
        lower === 'केन्द्रीय विद्यालय' ||
        lower === 'ਕੇਂਦਰੀ ਵਿਦਿਆਲਯ' ||
        lower === 'केन्द्रीयविद्यालयः' ||
        lower.includes('school') || lower.includes('vidyalaya');
    };

    // Update Meta
    setMeta(prev => {
      let newTitle = prev.title;
      let newSchool = prev.schoolName;
      let newInstructions = prev.generalInstructions;

      if (currentLang === 'Hindi') {
        if (isDefaultTitle(prev.title)) newTitle = 'अर्धवार्षिक परीक्षा';
        if (isDefaultSchool(prev.schoolName)) newSchool = 'केन्द्रीय विद्यालय';
        if (prev.generalInstructions.includes('All questions') || prev.generalInstructions.includes('ਸਾਰੇ ਪ੍ਰਸ਼ਨ') || prev.generalInstructions.includes('सर्वे प्रश्नाः'))
          newInstructions = t.defaultInstructions;
      } else if (currentLang === 'Punjabi') {
        if (isDefaultTitle(prev.title)) newTitle = 'ਅਰਧ ਸਾਲਾਨਾ ਪ੍ਰੀਖਿਆ';
        if (isDefaultSchool(prev.schoolName)) newSchool = 'ਕੇਂਦਰੀ ਵਿਦਿਆਲਯ';
        if (prev.generalInstructions.includes('All questions') || prev.generalInstructions.includes('सभी प्रश्न') || prev.generalInstructions.includes('सर्वे प्रश्नाः'))
          newInstructions = t.defaultInstructions;
      } else if (currentLang === 'Sanskrit') {
        if (isDefaultTitle(prev.title)) newTitle = 'अर्धवार्षिकपरीक्षा';
        if (isDefaultSchool(prev.schoolName)) newSchool = 'केन्द्रीयविद्यालयः';
        if (prev.generalInstructions.includes('All questions') || prev.generalInstructions.includes('सभी प्रश्न') || prev.generalInstructions.includes('ਸਾਰੇ ਪ੍ਰਸ਼ਨ'))
          newInstructions = t.defaultInstructions;
      } else {
        // Switch back to English defaults if we were on a localized default
        if (isDefaultTitle(prev.title)) newTitle = defaultEngTitle;
        if (isDefaultSchool(prev.schoolName)) newSchool = defaultEngSchool;
        if (prev.generalInstructions.includes('सभी प्रश्न') || prev.generalInstructions.includes('ਸਾਰੇ ਪ੍ਰਸ਼ਨ') || prev.generalInstructions.includes('सर्वे प्रश्नाः'))
          newInstructions = defaultEngInstructions;
      }

      // Time duration update
      const is3Hours = prev.duration === '3 Hours' || prev.duration === '3 घंटे' || prev.duration === '3 ਘੰਟੇ' || prev.duration === '३ होराः';
      let duration = prev.duration;
      if (is3Hours) {
        if (currentLang === 'Hindi') duration = '3 घंटे';
        else if (currentLang === 'Punjabi') duration = '3 ਘੰਟੇ';
        else if (currentLang === 'Sanskrit') duration = '३ होराः';
        else duration = '3 Hours';
      }

      return {
        ...prev,
        title: newTitle,
        schoolName: newSchool,
        duration: duration,
        generalInstructions: newInstructions
      };
    });

    // Update Sections (e.g. SECTION A -> खंड अ)
    setSections(prevSections => prevSections.map((sec, idx) => {
      let newTitle = sec.title;
      // Heuristic: if title looks like "SECTION X" or "खंड X", update it
      // We can just regenerate the default title for the index
      if (
        sec.title.startsWith('SECTION') ||
        sec.title.startsWith('खंड') ||
        sec.title.startsWith('ਭਾਗ') ||
        sec.title.startsWith('खण्डः')
      ) {
        const label = t.sectionLabels[idx] || String.fromCharCode(65 + idx);
        newTitle = `${t.section} ${label}`;
      }
      return { ...sec, title: newTitle };
    }));

  }, [currentLang]);


  const [blueprint, setBlueprint] = useState<BlueprintItem[]>([]);
  const [topic, setTopic] = useState('');
  const [qType, setQType] = useState<any>(QuestionType.MCQ);
  const [count, setCount] = useState(5);
  const [marksPerQ, setMarksPerQ] = useState(1);
  const [sections, setSections] = useState<Section[]>(internalExistingPaper?.sections || []);
  const [activeSectionId, setActiveSectionId] = useState<string>(internalExistingPaper?.sections[0]?.id || '');
  const [loadingAI, setLoadingAI] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');

  const handleClose = () => { onClose(); };
  const calculateTotalMarks = () => Number(sections.reduce((acc, s) => acc + s.totalMarks, 0).toFixed(2));

  const getGridClass = (options?: string[]) => {
    if (!options || options.length === 0) return 'grid-cols-1';
    const maxLength = Math.max(...options.map(o => cleanOptionText(o).length));
    const hasLatex = options.some(o => o.includes('$'));
    const singleLineThreshold = hasLatex ? 45 : 25;
    const twoColThreshold = hasLatex ? 80 : 45;
    if (maxLength < singleLineThreshold) return 'grid-cols-4';
    if (maxLength < twoColThreshold) return 'grid-cols-2';
    return 'grid-cols-1';
  };

  const handleAddToBlueprint = () => {
    const newItem: BlueprintItem = { id: generateId(), topic, type: qType, count, marks: marksPerQ };
    setBlueprint([...blueprint, newItem]);
    setCount(5);
  };
  const handleRemoveBlueprintItem = (id: string) => { setBlueprint(blueprint.filter(i => i.id !== id)); };

  const getSectionLabel = (idx: number) => {
    return t.sectionLabels[idx] || String.fromCharCode(65 + idx);
  };

  const handleGenerateFullPaper = async () => {
    if (blueprint.length === 0) return alert("Please add items to the blueprint first.");

    // Check Credits
    const currentUser = await StorageService.getUser(userEmail);
    if (!isAdmin && currentUser && currentUser.credits <= 0) {
      return alert("Insufficient credits! You need credits to generate a new paper. Please upgrade.");
    }

    setLoadingAI(true);
    setGenerationStatus("Initializing...");
    try {
      const styleContext = await StorageService.getStyleContext(meta.classNum, meta.subject);
      const generatedSections: Section[] = [];
      for (let i = 0; i < blueprint.length; i++) {
        const item = blueprint[i];

        const label = getSectionLabel(i);
        const sectionTitle = `${t.section} ${label}`;

        setGenerationStatus(`Generating Section ${label}: ${item.count} ${item.type} questions for ${item.topic}...`);
        const generatedQs = await generateQuestionsWithAI(meta.classNum, meta.subject, item.topic, item.type, item.count, item.marks, styleContext);
        generatedSections.push({
          id: generateId(), title: sectionTitle, questions: generatedQs,
          totalMarks: Number(generatedQs.reduce((sum, q) => sum + q.marks, 0).toFixed(2))
        });
      }

      // Deduct credit after successful generation
      if (!isAdmin && currentUser) {
        currentUser.credits -= 1;
        await StorageService.updateUser(currentUser);
        setUser(currentUser); // Update local state
      }

      setSections(generatedSections);
      if (generatedSections.length > 0) setActiveSectionId(generatedSections[0].id);
      setStep(3);
    } catch (e) { alert("Error generating paper."); } finally { setLoadingAI(false); setGenerationStatus(""); }
  };

  const handleRegenerateQuestion = async (sectionId: string, question: Question) => {
    let maxRegenerations = 0;
    if (isStarter) maxRegenerations = 1;
    else if (isProfessional) maxRegenerations = 2;
    else if (user?.subscriptionPlan === SubscriptionPlan.PREMIUM || isAdmin) maxRegenerations = 3;
    else if (isFree) maxRegenerations = 1;

    const currentRegenCount = (question as any).regenerateCount || 0;

    if (currentRegenCount >= maxRegenerations) {
      return alert(`Limit Reached: You can regenerate a question ${maxRegenerations} time(s) on your current plan.`);
    }

    setRegeneratingQuestionId(question.id);
    try {
      const styleContext = await StorageService.getStyleContext(meta.classNum, meta.subject);
      const newQuestions = await generateQuestionsWithAI(meta.classNum, meta.subject, question.topic, question.type, 1, question.marks, styleContext);

      if (newQuestions.length > 0) {
        const newQ = {
          ...newQuestions[0],
          id: question.id,
          regenerateCount: currentRegenCount + 1
        };
        setSections(prev => prev.map(s => {
          if (s.id !== sectionId) return s;
          return {
            ...s,
            questions: s.questions.map(q => q.id === question.id ? newQ : q)
          };
        }));
      }
    } catch (e) {
      alert("Failed to regenerate question. Please try again.");
    } finally {
      setRegeneratingQuestionId(null);
    }
  };

  const handleDeleteSection = (secId: string) => {
    if (window.confirm("Delete this ENTIRE section?")) setSections(prev => prev.filter(s => s.id !== secId));
  };
  const handleAddQuestionToSection = (sectionId: string) => {
    const newQ: Question = { id: generateId(), type: QuestionType.SA, text: "New Question (Edit me)", marks: 2, topic: meta.subject };
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, questions: [...s.questions, newQ], totalMarks: Number((s.totalMarks + newQ.marks).toFixed(2)) } : s));
  };
  const handleUpdateSectionTitle = (sectionId: string, newTitle: string) => {
    setSections(prev => prev.map(s => s.id === sectionId ? { ...s, title: newTitle } : s));
  };
  const handleUpdateQuestion = (sectionId: string, qId: string, field: keyof Question, value: any) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      const updatedQs = s.questions.map(q => q.id === qId ? { ...q, [field]: value } : q);
      const newTotal = updatedQs.reduce((sum, q) => sum + q.marks, 0);
      return { ...s, questions: updatedQs, totalMarks: Number(newTotal.toFixed(2)) };
    }));
  };
  const handleDeleteQuestion = (sectionId: string, qId: string) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s;
      const newQuestions = s.questions.filter(q => q.id !== qId);
      const newTotal = newQuestions.reduce((sum, q) => sum + q.marks, 0);
      return { ...s, questions: newQuestions, totalMarks: Number(newTotal.toFixed(2)) };
    }));
  };
  const handleGenerateImage = async (sectionId: string, qId: string, prompt: string) => {
    const section = sections.find(s => s.id === sectionId); if (!section) return;
    const question = section.questions.find(q => q.id === qId); if (!question) return;

    setGeneratingImageId(qId);
    try {
      const imgUrl = await generateImageForQuestion(prompt || question.text);
      setSections(prev => prev.map(s => {
        if (s.id !== sectionId) return s;
        return {
          ...s,
          questions: s.questions.map(q => q.id === qId ? { ...q, imageUrl: imgUrl, imageWidth: 50 } : q)
        };
      }));
    } catch (e) {
      alert("Image generation failed. Please try again.");
    } finally {
      setGeneratingImageId(null);
    }
  };
  const handleUploadImage = (sectionId: string, qId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      // Instead of setting directly, open cropper
      setCropImageSrc(reader.result as string);
      setLastUploadedFile({ sectionId, qId });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const onCropComplete = (croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const handleSaveCrop = async () => {
    if (!cropImageSrc || !croppedAreaPixels || !lastUploadedFile) return;
    try {
      const croppedImage = await getCroppedImg(cropImageSrc, croppedAreaPixels);
      setSections(prev => prev.map(s => {
        if (s.id !== lastUploadedFile.sectionId) return s;
        return {
          ...s,
          questions: s.questions.map(q => q.id === lastUploadedFile.qId ? { ...q, imageUrl: croppedImage, imageWidth: 50 } : q)
        };
      }));
      setCropImageSrc(null);
      setLastUploadedFile(null);
    } catch (e) {
      console.error(e);
      alert("Failed to crop image.");
    }
  };

  const savePaperInternal = async (paper: QuestionPaper) => {
    await StorageService.savePaper(paper);
  };

  const handleSavePaper = async () => {
    if (readOnly) return;

    const currentUser = await StorageService.getUser(userEmail);
    if (!currentUser) return;

    const newPaper: QuestionPaper = {
      id: internalExistingPaper ? internalExistingPaper.id : generateId(),
      ...meta,
      sections,
      createdAt: internalExistingPaper ? internalExistingPaper.createdAt : new Date().toISOString(),
      createdBy: internalExistingPaper ? internalExistingPaper.createdBy : userEmail,
      visibleToTeacher: internalExistingPaper ? internalExistingPaper.visibleToTeacher : true,
      visibleToAdmin: internalExistingPaper ? internalExistingPaper.visibleToAdmin : true,
      editCount: internalExistingPaper ? (internalExistingPaper.editCount || 0) + 1 : 0,
      downloadCount: internalExistingPaper ? (internalExistingPaper.downloadCount || 0) : 0
    };

    await savePaperInternal(newPaper);

    setInternalExistingPaper(newPaper);
    alert("Paper saved successfully. You can continue editing or download PDF.");
  };

  const handleDownloadPDF = async (type: 'paper' | 'key' = 'paper') => {
    if (readOnly) return alert("Download not available in View-Only mode.");

    const currentUser = await StorageService.getUser(userEmail);
    if (!currentUser) return;

    if (internalExistingPaper && currentUser.role !== UserRole.ADMIN && (
      currentUser.subscriptionPlan === SubscriptionPlan.PROFESSIONAL ||
      currentUser.subscriptionPlan === SubscriptionPlan.FREE ||
      currentUser.subscriptionPlan === SubscriptionPlan.STARTER
    )) {
      const currentCount = internalExistingPaper.downloadCount || 0;
      if (currentCount >= 1) {
        return alert("Subscription Plan Limit Reached: You have already used your 1 download for this paper.");
      }
    }

    const isEdit = !!internalExistingPaper;

    if (!isEdit) {
      // Saving new paper before download. Credit was already paid at Blueprint.
      const newPaper: QuestionPaper = {
        id: generateId(),
        ...meta,
        sections,
        createdAt: new Date().toISOString(),
        createdBy: userEmail,
        visibleToTeacher: true,
        visibleToAdmin: true,
        editCount: 0,
        downloadCount: 0
      };
      await savePaperInternal(newPaper);
      setInternalExistingPaper(newPaper);
    }

    const element = document.getElementById('print-area-content');
    if (!element) return;

    // element is already in DOM but hidden via CSS class or parent
    // We need to make sure it's visible for html2pdf but not to user if we can avoid it.
    // Actually html2pdf works on hidden elements if we clone or if we handle it right.
    // But easiest is to have a specific print container.

    setPreviewMode(type);
    setIsGeneratingPdf(true);

    setTimeout(() => {
      const sanitizedTitle = meta.title.replace(/[^a-zA-Z0-9-_]/g, '_');
      const filename = `${sanitizedTitle}_${meta.classNum}_${meta.subject}${type === 'key' ? '_AnswerKey' : ''}.pdf`;
      const opt = {
        margin: 0,
        filename: filename,
        image: { type: 'jpeg', quality: 1.0 },
        html2canvas: { scale: 3, useCORS: true, x: 0, y: 0, scrollX: 0, scrollY: 0, logging: false },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
      };

      const cleanup = async () => {
        setIsGeneratingPdf(false);

        const currentPaperId = internalExistingPaper?.id;

        if (currentPaperId && !isAdmin && !autoDownload) {
          const papers = await StorageService.getPapersByUser(userEmail);
          const p = papers.find(p => p.id === currentPaperId);
          if (p) {
            const updatedPaper = { ...p, downloadCount: (p.downloadCount || 0) + 1 };
            await StorageService.savePaper(updatedPaper);
          }
        }

        if (autoDownload) {
          onClose();
          return;
        }

        if (type === 'key') {
          if (downloadedFiles.paper) {
            onClose();
          } else {
            setDownloadedFiles(prev => ({ ...prev, key: true }));
          }
        } else {
          if (downloadedFiles.key) {
            onClose();
          } else {
            setDownloadedFiles(prev => ({ ...prev, paper: true }));
          }
        }
      };

      // @ts-ignore
      if (window.html2pdf) {
        // @ts-ignore
        window.html2pdf().set(opt).from(element).save().then(cleanup).catch(cleanup);
      } else {
        window.print();
        cleanup();
      }
    }, 500);
  };

  // Class & Subject Translations
  const CLASS_TRANSLATIONS: any = {
    Hindi: { 'VI': 'छठी', 'VII': 'सातवीं', 'VIII': 'आठवीं', 'IX': 'नौवीं', 'X': 'दसवीं', 'XI': 'ग्यारहवीं', 'XII': 'बारहवीं' },
    Punjabi: { 'VI': 'ਛੇਵੀਂ', 'VII': 'ਸੱਤਵੀਂ', 'VIII': 'ਅੱਠਵੀਂ', 'IX': 'ਨੌਵੀਂ', 'X': 'ਦਸਵੀਂ', 'XI': 'ਗਿਆਰਵੀਂ', 'XII': 'ਬਾਰ੍ਹਵੀਂ' },
    Sanskrit: { 'VI': 'षष्ठी', 'VII': 'सप्तमी', 'VIII': 'अष्टमी', 'IX': 'नवमी', 'X': 'दशमी', 'XI': 'एकादशी', 'XII': 'द्वादशी' }
  };

  const SUBJECT_DISPLAY: any = {
    Hindi: { 'Hindi': 'हिन्दी', 'Punjabi': 'पंजाबी', 'Sanskrit': 'संस्कृत' },
    Punjabi: { 'Hindi': 'ਹਿੰਦੀ', 'Punjabi': 'ਪੰਜਾਬੀ', 'Sanskrit': 'ਸੰਸਕ੍ਰਿਤ' },
    Sanskrit: { 'Hindi': 'हिन्दी', 'Punjabi': 'पंजाबी', 'Sanskrit': 'संस्कृतम्' } // fallback to Hindi script for Sanskrit generally
  };

  const renderHeader = () => {
    // Determine Display Strings
    let displayClass = meta.classNum;
    let displaySubject = meta.subject;

    if (currentLang !== 'English' && CLASS_TRANSLATIONS[currentLang] && CLASS_TRANSLATIONS[currentLang][meta.classNum]) {
      displayClass = CLASS_TRANSLATIONS[currentLang][meta.classNum];
      // Check if we often prefix with Class, usually header is just "Class: X" or "कक्षा: दसवीं"
      // The layout below handles the label separately.
    }

    // Attempt to translate subject if it matches one of our targets
    // We normalize to Title Case for lookup
    const subjKey = meta.subject.charAt(0).toUpperCase() + meta.subject.slice(1).toLowerCase();
    if (currentLang !== 'English' && SUBJECT_DISPLAY[currentLang] && SUBJECT_DISPLAY[currentLang][subjKey]) {
      displaySubject = SUBJECT_DISPLAY[currentLang][subjKey];
    } else if (currentLang === 'Hindi' && subjKey === 'English') {
      // Example fallback: keeping English as English or translating it? Usually keeps as English subject name if teaching English.
      // But user asked for specific languages.
    }

    return (
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold uppercase mb-1 whitespace-pre-wrap">{meta.schoolName}</h1>
        <h2 className="text-xl font-bold uppercase mb-2 underline whitespace-pre-wrap">{meta.title}</h2>
        <div className="border-t-2 border-b-2 border-black py-1 flex justify-between items-center text-sm font-bold uppercase">
          <div className="w-1/3 text-left">
            <span>{t.time}: {meta.duration}</span>
          </div>
          <div className="w-1/3 text-center">
            <span>{t.class}: {displayClass}</span>
            <span className="mx-2">|</span>
            <span>{t.session}: {meta.session}</span>
          </div>
          <div className="w-1/3 text-right">
            <span>{t.maxMarks}: {calculateTotalMarks()}</span>
          </div>
        </div>
        <div className="font-bold uppercase mt-1 border-b-2 border-black pb-1">
          {t.subject}: {displaySubject}
        </div>
      </div>
    );
  };


  const renderPrintContent = () => {
    let printViewQuestionCounter = 0;
    return (
      <div className="bg-white text-black w-[210mm] min-h-[297mm] text-base leading-snug box-border shadow-none break-words" style={{ padding: '0.5in' }}>
        {renderHeader()}
        {meta.generalInstructions && meta.generalInstructions.trim() && (
          <div className="mb-1 text-sm"><h3 className="font-bold underline mb-1 uppercase">{t.generalInstructions}:</h3><p className="whitespace-pre-wrap leading-snug">{meta.generalInstructions}</p></div>
        )}
        {sections.map((section) => (
          <div key={section.id} className="mb-3">
            {section.title && section.title.trim() && (
              <div className="text-center mb-2 border-b border-gray-400 pb-1"><h3 className="uppercase text-lg font-bold whitespace-pre-wrap"><MathText text={section.title} /></h3></div>
            )}
            <div className="space-y-1">
              {section.questions.map((q) => {
                const qNum = ++printViewQuestionCounter;
                return (

                  <div key={q.id} className="break-inside-avoid relative">
                    <div className="flex gap-2"><span className="font-bold">{q.customNumber || `${t.questionPrefix}${qNum}${currentLang === 'English' ? '.' : ''}`}</span><div className="flex-1"><p className="whitespace-pre-wrap leading-snug text-justify break-words"><MathText text={q.text} /></p>
                      {q.options && q.options.length > 0 && (
                        <div className={`grid gap-x-8 gap-y-1 mt-1 ml-2 ${q.type === QuestionType.ASSERTION_REASON ? 'grid-cols-1' : getGridClass(q.options)}`}>
                          {q.options.map((opt, oIdx) => (<div key={oIdx} className="flex gap-2"><span className="font-semibold">({String.fromCharCode(97 + oIdx)})</span><span><MathText text={cleanOptionText(opt)} /></span></div>))}
                        </div>
                      )}
                      {q.type === QuestionType.MATCH && q.matchPairs && (
                        <div className="mt-2 ml-2 w-full">
                          <div className="font-bold mb-1">Match the Following:</div>
                          <table className="w-full text-sm border-collapse">
                            <thead>
                              <tr>
                                <th className="text-left p-1 w-1/2 border-b-2 border-black">Column A</th>
                                <th className="text-left p-1 w-1/2 border-b-2 border-black">Column B</th>
                              </tr>
                            </thead>
                            <tbody>
                              {q.matchPairs.map((pair, idx) => (
                                <tr key={idx}>
                                  <td className="p-1 align-top border-b border-gray-100">
                                    <span className="font-bold mr-2">{String.fromCharCode(65 + idx)}.</span>
                                    <MathText text={cleanOptionText(pair.left)} />
                                  </td>
                                  <td className="p-1 align-top border-b border-gray-100">
                                    <span className="font-bold mr-2">{idx + 1}.</span>
                                    <MathText text={cleanOptionText(pair.right)} />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {q.imageUrl && (<div className="mt-2 flex justify-center"><ResizableImage src={q.imageUrl} initialWidth={q.imageWidth} onResize={() => { }} onRemove={() => { }} readOnly /></div>)}
                    </div><span className="font-bold text-sm w-8 text-right align-top">[{q.marks}]</span></div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    )
  };

  const renderAnswerKeyContent = () => {
    let qCounter = 0;
    return (
      <div className="bg-white text-black w-[210mm] min-h-[297mm] text-base leading-snug box-border shadow-none break-words" style={{ padding: '0.5in' }}>
        <div className="text-center mb-6"><h1 className="text-2xl font-bold uppercase underline">{t.answerKey}</h1><h2 className="text-lg font-bold">{meta.schoolName}</h2><div className="text-sm font-bold mt-2">{t.class}: {meta.classNum} | {t.subject}: {meta.subject} | {meta.title}</div></div>
        {sections.map((section) => (
          <div key={section.id} className="mb-4">
            {section.title && section.title.trim() && <div className="font-bold uppercase underline mb-2 text-sm">{section.title}</div>}
            <div className="space-y-2">
              {section.questions.map((q) => {
                const qNum = ++qCounter;
                return (<div key={q.id} className="flex gap-2 break-inside-avoid"><span className="font-bold w-10">{q.customNumber || `${t.questionPrefix}${qNum}${currentLang === 'English' ? '.' : ''}`}</span><div className="flex-1"><div className="font-medium text-gray-900"><MathText text={q.answer || "Answer not available"} /></div></div><span className="text-xs font-bold text-gray-500">[{q.marks}]</span></div>)
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loadingAI) return <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center"><h2 className="text-2xl font-bold animate-pulse">Generating Paper...</h2><p>{generationStatus}</p></div>;

  let editViewQuestionCounter = 0;

  if (autoDownload) {
    return (
      <>
        <div className="fixed inset-0 bg-white z-[9999] opacity-0 pointer-events-none" aria-hidden="true"></div>
        <div id="print-area" className="print-only"><div id="print-area-content" className="print-content-container" style={{ width: '210mm' }}>{autoDownload === 'key' ? renderAnswerKeyContent() : renderPrintContent()}</div></div>
      </>
    );
  }

  return (
    <>
      {/* Hidden Print Area for PDF Generation */}
      <div id="print-area" className="fixed top-0 left-0 -z-50 opacity-0 pointer-events-none print-only">
        <div id="print-area-content" className="print-content-container" style={{ width: '210mm' }}>
          {previewMode === 'key' ? renderAnswerKeyContent() : renderPrintContent()}
        </div>
      </div>

      {/* Crop Modal */}
      {cropImageSrc && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-bold">Crop Image</h3>
              <button onClick={() => { setCropImageSrc(null); setLastUploadedFile(null); }} className="text-gray-500 hover:text-red-500"><i className="fas fa-times"></i></button>
            </div>
            <div className="relative flex-1 bg-black">
              <Cropper
                image={cropImageSrc}
                crop={crop}
                zoom={zoom}
                aspect={4 / 3}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>
            <div className="p-4 bg-white border-t flex justify-between items-center">
              <div className="flex gap-4 w-1/2 items-center">
                <span className="text-sm font-bold">Zoom</span>
                <input type="range" value={zoom} min={1} max={3} step={0.1} aria-labelledby="Zoom" onChange={(e) => setZoom(Number(e.target.value))} className="w-full" />
              </div>
              <button onClick={handleSaveCrop} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700">Save Crop</button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b bg-gray-50">
              <h3 className="font-bold text-lg">Paper Preview</h3>
              <div className="flex gap-2">
                <div className="flex bg-gray-200 rounded p-1 text-sm">
                  <button onClick={() => setPreviewMode('paper')} className={`px-3 py-1 rounded ${previewMode === 'paper' ? 'bg-white shadow text-blue-600 font-bold' : 'text-gray-600'}`}>Question Paper</button>
                  <button onClick={() => setPreviewMode('key')} className={`px-3 py-1 rounded ${previewMode === 'key' ? 'bg-white shadow text-blue-600 font-bold' : 'text-gray-600'}`}>Answer Key</button>
                </div>
                <button onClick={() => setShowPreviewModal(false)} className="text-gray-500 hover:text-red-500 px-3"><i className="fas fa-times fa-lg"></i></button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-gray-100 p-8 flex justify-center">
              <div className="bg-white shadow-lg scale-90 origin-top" style={{ width: '210mm', minHeight: '297mm' }}>
                {previewMode === 'key' ? renderAnswerKeyContent() : renderPrintContent()}
              </div>
            </div>
            <div className="p-4 border-t bg-white flex justify-end gap-3">
              <button onClick={() => setShowPreviewModal(false)} className="px-4 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg">Close</button>
              <button onClick={() => { setShowPreviewModal(false); handleDownloadPDF(previewMode); }} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-lg flex items-center gap-2">
                <i className="fas fa-download"></i> Download PDF
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="fixed inset-0 bg-white z-50 flex flex-col overflow-hidden no-print">
        <div className="bg-white border-b px-4 py-3 flex justify-between items-center shadow-sm shrink-0 z-10">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-800">{internalExistingPaper ? (readOnly ? 'View Paper (Read Only)' : 'Edit Paper') : (step === 1 ? 'Exam Details' : step === 2 ? 'Blueprint' : 'Preview & Edit')}</h2>
            {!readOnly && (isProfessional || isFree || isStarter) && !isAdmin && internalExistingPaper && (
              <div className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                Downloads Used: {internalExistingPaper.downloadCount || 0}/1
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {step === 3 && !readOnly && <button onClick={() => setStep(2)} className="text-blue-600 font-bold hover:bg-blue-50 px-3 py-1 rounded"><i className="fas fa-arrow-left"></i> Back to Blueprint</button>}
            <button onClick={handleClose} className="text-gray-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-full transition-colors shrink-0"><i className="fas fa-times fa-lg"></i></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-gray-50 p-4 pb-32">
          <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm p-4 md:p-8 min-h-[400px]">

            {step === 1 && (
              <div className="space-y-6">
                {readOnly && <div className="bg-yellow-100 text-yellow-800 p-2 rounded mb-4 text-center font-bold">You are in Read-Only Mode.</div>}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-1">Class</label>
                    <select disabled={readOnly} className="w-full border rounded p-2" value={meta.classNum} onChange={(e) => setMeta({ ...meta, classNum: e.target.value })}>
                      {(!Array.isArray(classList) || classList.length === 0) && <option>No classes available</option>}
                      {Array.isArray(classList) && classList.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Subject</label>
                    <select disabled={readOnly} className="w-full border rounded p-2" value={meta.subject} onChange={(e) => setMeta({ ...meta, subject: e.target.value })}>
                      {!meta.classNum || !curriculumConfig[meta.classNum] || !Array.isArray(curriculumConfig[meta.classNum]) || curriculumConfig[meta.classNum].length === 0 ? <option>No subjects available</option> : null}
                      {meta.classNum && Array.isArray(curriculumConfig[meta.classNum]) && curriculumConfig[meta.classNum].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div><label className="block text-sm font-medium mb-1">Session</label><input disabled={readOnly} className="w-full border rounded p-2" value={meta.session} onChange={e => setMeta({ ...meta, session: e.target.value })} /></div>
                  <div><label className="block text-sm font-medium mb-1">School Name</label><input disabled={readOnly} className="w-full border rounded p-2" value={meta.schoolName} onChange={e => setMeta({ ...meta, schoolName: e.target.value })} placeholder={t.schoolName} /></div>
                  <div><label className="block text-sm font-medium mb-1">Exam Title</label><input disabled={readOnly} className="w-full border rounded p-2" value={meta.title} onChange={e => setMeta({ ...meta, title: e.target.value })} placeholder={t.examTitle} /></div>
                  <div><label className="block text-sm font-medium mb-1">Duration</label><input disabled={readOnly} className="w-full border rounded p-2" value={meta.duration} onChange={e => setMeta({ ...meta, duration: e.target.value })} /></div>
                  <div><label className="block text-sm font-medium mb-1">Max Marks</label><input disabled={readOnly} type="number" className="w-full border rounded p-2" value={meta.maxMarks} onChange={e => setMeta({ ...meta, maxMarks: parseInt(e.target.value) })} /></div>
                </div>
                <div><label className="block text-sm font-medium mb-1">General Instructions</label><textarea disabled={readOnly} className="w-full border rounded p-2 h-32" value={meta.generalInstructions} onChange={e => setMeta({ ...meta, generalInstructions: e.target.value })} /></div>

                <div className="pt-6 flex justify-end">
                  {!readOnly ? (
                    <button onClick={() => setStep(2)} className="bg-blue-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-700">Next <i className="fas fa-arrow-right"></i></button>
                  ) : (
                    <button onClick={() => setStep(3)} className="bg-gray-800 text-white px-6 py-2 rounded">Go to Preview</button>
                  )}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-8">
                {!readOnly && (
                  <div className="bg-blue-50 p-4 sm:p-6 rounded-xl border border-blue-100">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                      <div className="lg:col-span-1"><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Topic</label><input type="text" className="w-full border rounded p-2" value={topic} onChange={(e) => setTopic(e.target.value)} /></div>
                      <div className="lg:col-span-1">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Type</label>
                        <select className="w-full border rounded p-2 bg-white" value={qType} onChange={(e) => setQType(e.target.value)}>
                          {Array.isArray(availableQTypes) && availableQTypes.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3 lg:col-span-2">
                        <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Count</label><input type="number" className="w-full border rounded p-2" value={count} min="1" onChange={(e) => setCount(parseInt(e.target.value) || 0)} /></div>
                        <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Marks</label><input type="number" className="w-full border rounded p-2" value={marksPerQ} min="0.5" step="0.5" onChange={(e) => setMarksPerQ(parseFloat(e.target.value) || 0)} /></div>
                      </div>
                      <div className="lg:col-span-1"><button onClick={handleAddToBlueprint} className="w-full bg-blue-600 text-white py-2 rounded font-bold">Add</button></div>
                    </div>
                  </div>
                )}
                <div className="border rounded-lg overflow-hidden shadow-sm">
                  {blueprint.map((item, idx) => (
                    <div key={item.id} className="flex justify-between items-center p-4 border-b">
                      <div className="flex items-center gap-3"><div className="bg-blue-100 text-blue-800 font-bold px-3 py-1 rounded">{getSectionLabel(idx)}</div><div><div className="font-bold">{item.topic}</div><div className="text-sm">{item.count} x {item.type}</div></div></div>
                      {!readOnly && <button onClick={() => handleRemoveBlueprintItem(item.id)}><i className="fas fa-trash text-red-400"></i></button>}
                    </div>
                  ))}
                </div>
                {!readOnly && <div className="pt-6 border-t"><button onClick={handleGenerateFullPaper} className="w-full bg-green-600 text-white py-4 rounded-xl font-bold text-lg" disabled={blueprint.length === 0}>Generate Question Paper</button></div>}
              </div>
            )}

            {step === 3 && (
              <div className="flex flex-col space-y-8">
                {readOnly && <div className="bg-yellow-100 text-yellow-800 p-2 rounded text-center font-bold">Read-Only Mode: Viewing Paper</div>}
                <div className="text-center border-b pb-6 space-y-4">
                  <input disabled={readOnly} className="block w-full text-center text-xl font-bold uppercase border-none" value={meta.schoolName} onChange={(e) => setMeta({ ...meta, schoolName: e.target.value })} placeholder={t.schoolName} />
                </div>

                <div className="space-y-10">
                  {sections.map((section) => (
                    <div key={section.id} className="relative group/section">
                      <div className="flex flex-col items-center justify-center mb-6 gap-2">
                        <div className="relative w-full flex items-start gap-2">
                          <textarea disabled={readOnly} className="flex-1 text-center font-bold text-lg uppercase resize-none overflow-hidden font-mono" value={section.title} onChange={(e) => handleUpdateSectionTitle(section.id, e.target.value)} placeholder="SECTION TITLE" rows={Math.max(1, Math.ceil(section.title.length / 40))} />
                          {!readOnly && (
                            <div className="flex gap-1">
                              <button type="button" onClick={() => handleUpdateSectionTitle(section.id, "")} className="p-2 border" title="Clear Heading"><i className="fas fa-eraser"></i></button>
                              <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteSection(section.id) }} className="p-2 border text-red-500 z-10 cursor-pointer" title="Delete Section"><i className="fas fa-trash-alt"></i></button>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="space-y-6">
                        {section.questions.map((q, idx) => {
                          const currentQNum = ++editViewQuestionCounter;

                          let maxRegenerations = 0;
                          if (isStarter) maxRegenerations = 1;
                          else if (isProfessional) maxRegenerations = 2;
                          else if (user?.subscriptionPlan === SubscriptionPlan.PREMIUM || isAdmin) maxRegenerations = 3;
                          else if (isFree) maxRegenerations = 1;

                          const regenCount = (q as any).regenerateCount || 0;
                          const isRegenLimitReached = regenCount >= maxRegenerations;

                          return (
                            <div key={q.id} className="flex gap-3 border-b border-gray-100 pb-6 last:border-0">
                              <input disabled={readOnly} className="font-bold w-10 text-right" value={q.customNumber || (currentLang === 'English' ? `Q${currentQNum}.` : `${t.questionPrefix} ${currentQNum}`)} onChange={(e) => handleUpdateQuestion(section.id, q.id, 'customNumber', e.target.value)} />
                              <div className="flex-1 space-y-3">
                                <textarea disabled={readOnly} className="w-full p-2 border rounded font-mono" value={q.text} onChange={(e) => handleUpdateQuestion(section.id, q.id, 'text', e.target.value)} rows={Math.max(2, Math.ceil(q.text.length / 45))} />
                                {q.options && <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{q.options.map((opt, optIdx) => (<div key={optIdx} className="flex gap-2"><span className="font-bold">{String.fromCharCode(65 + optIdx)}.</span><input disabled={readOnly} className="w-full border-none" value={cleanOptionText(opt)} onChange={(e) => { const newOpts = [...q.options!]; newOpts[optIdx] = e.target.value; handleUpdateQuestion(section.id, q.id, 'options', newOpts); }} /></div>))}</div>}

                                {q.type === QuestionType.MATCH && q.matchPairs && (
                                  <div className="border rounded p-3 bg-gray-50">
                                    <div className="font-bold text-xs uppercase text-gray-500 mb-2">Match Pairs Editor</div>
                                    {q.matchPairs.map((pair, pIdx) => (
                                      <div key={pIdx} className="flex gap-2 mb-2">
                                        <div className="flex-1 flex gap-1">
                                          <span className="font-bold p-1 bg-gray-200 text-xs rounded">{String.fromCharCode(65 + pIdx)}</span>
                                          <input
                                            disabled={readOnly}
                                            className="w-full border rounded p-1 text-sm"
                                            value={pair.left}
                                            onChange={(e) => {
                                              const newPairs = [...q.matchPairs!];
                                              newPairs[pIdx].left = e.target.value;
                                              handleUpdateQuestion(section.id, q.id, 'matchPairs', newPairs);
                                            }}
                                            placeholder="Left Item"
                                          />
                                        </div>
                                        <div className="flex-1 flex gap-1">
                                          <span className="font-bold p-1 bg-gray-200 text-xs rounded">{pIdx + 1}</span>
                                          <input
                                            disabled={readOnly}
                                            className="w-full border rounded p-1 text-sm"
                                            value={pair.right}
                                            onChange={(e) => {
                                              const newPairs = [...q.matchPairs!];
                                              newPairs[pIdx].right = e.target.value;
                                              handleUpdateQuestion(section.id, q.id, 'matchPairs', newPairs);
                                            }}
                                            placeholder="Right Item"
                                          />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {q.imageUrl && (
                                  <div className="mt-2">
                                    <ResizableImage
                                      src={q.imageUrl}
                                      initialWidth={q.imageWidth}
                                      onResize={(w) => handleUpdateQuestion(section.id, q.id, 'imageWidth', w)}
                                      onRemove={() => handleUpdateQuestion(section.id, q.id, 'imageUrl', undefined)}
                                      readOnly={readOnly}
                                    />
                                  </div>
                                )}

                                {!readOnly && (
                                  <div className="flex gap-2 pt-2">
                                    <button
                                      onClick={() => handleRegenerateQuestion(section.id, q)}
                                      disabled={isRegenLimitReached || regeneratingQuestionId === q.id}
                                      className={`text-xs px-3 py-1 rounded border flex items-center gap-1 ${isRegenLimitReached ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                                      title={isRegenLimitReached ? "Regeneration limit reached for this question" : "Regenerate this question with AI"}
                                    >
                                      <i className={`fas fa-sync-alt ${regeneratingQuestionId === q.id ? 'fa-spin' : ''}`}></i>
                                      {regeneratingQuestionId === q.id ? 'Regenerating...' : 'Regenerate'}
                                      <span className="ml-1 text-[10px] bg-white px-1 rounded border">
                                        {regenCount}/{maxRegenerations}
                                      </span>
                                    </button>

                                    <div className="relative">
                                      <input type="file" id={`img-${q.id}`} className="hidden" accept="image/*" onChange={(e) => handleUploadImage(section.id, q.id, e)} />
                                      <label htmlFor={`img-${q.id}`} className="text-xs px-3 py-1 rounded border bg-gray-50 text-gray-600 hover:bg-gray-100 cursor-pointer flex items-center gap-1">
                                        <i className="fas fa-upload"></i> Upload Image
                                      </label>
                                    </div>

                                    <button
                                      onClick={() => {
                                        const userPrompt = prompt("Describe the diagram you want:", q.text);
                                        if (userPrompt) handleGenerateImage(section.id, q.id, userPrompt);
                                      }}
                                      disabled={generatingImageId === q.id}
                                      className="text-xs px-3 py-1 rounded border bg-purple-50 text-purple-600 hover:bg-purple-100 flex items-center gap-1"
                                    >
                                      <i className={`fas fa-magic ${generatingImageId === q.id ? 'fa-spin' : ''}`}></i>
                                      {generatingImageId === q.id ? 'Drawing...' : 'AI Diagram'}
                                    </button>

                                    <button onClick={() => handleDeleteQuestion(section.id, q.id)} className="text-xs px-3 py-1 rounded border bg-red-50 text-red-500 hover:bg-red-100 ml-auto"><i className="fas fa-trash"></i></button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {!readOnly && <button onClick={() => handleAddQuestionToSection(section.id)} className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-500 hover:text-blue-500 font-bold transition-colors"><i className="fas fa-plus"></i> Add Question</button>}
                      </div>
                    </div>
                  ))}
                  {!readOnly && <button onClick={() => setSections([...sections, { id: generateId(), title: "NEW SECTION", questions: [], totalMarks: 0 }])} className="w-full py-4 bg-gray-100 rounded-xl font-bold text-gray-600 hover:bg-gray-200"><i className="fas fa-plus-circle"></i> Add New Section</button>}
                </div>

                <div className="pt-8 border-t flex justify-between items-center">
                  <div className="text-xl font-bold">Total Marks: {calculateTotalMarks()} / {meta.maxMarks}</div>
                  <div className="flex gap-4">
                    {!readOnly && <button onClick={handleSavePaper} className="bg-green-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-green-700 shadow-lg"><i className="fas fa-save mr-2"></i> Save Paper</button>}
                    <button onClick={() => { setPreviewMode('paper'); setShowPreviewModal(true); }} className="bg-purple-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-purple-700 shadow-lg"><i className="fas fa-eye mr-2"></i> Preview</button>
                    <button onClick={() => handleDownloadPDF('paper')} className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 shadow-lg"><i className="fas fa-file-pdf mr-2"></i> Download PDF</button>
                    <button onClick={() => handleDownloadPDF('key')} className="bg-gray-800 text-white px-6 py-3 rounded-lg font-bold hover:bg-gray-900 shadow-lg"><i className="fas fa-key mr-2"></i> Download Answer Key</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default PaperGenerator;


import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storageService';
import { PaymentRequest, User, QuestionPaper, SubscriptionStatus, UserRole, SubscriptionPlan, ContentPage } from '../types';
import PaperGenerator from './PaperGenerator';
import { ErrorBoundary } from './ErrorBoundary';

interface Props {
  user: User;
}

const AdminPanel: React.FC<Props> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'requests' | 'users' | 'papers' | 'patterns' | 'curriculum' | 'content'>('dashboard');
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [papers, setPapers] = useState<QuestionPaper[]>([]);
  const [view, setView] = useState<'dashboard' | 'create'>('dashboard');
  const [selectedPaper, setSelectedPaper] = useState<QuestionPaper | null>(null);

  // Folder View State
  const [selectedFolderUser, setSelectedFolderUser] = useState<string | null>(null); // email of the user whose folder is open

  // Stats State
  const [stats, setStats] = useState({
    usersByPlan: {} as Record<string, number>,
    revenue: { total: 0, monthly: 0, yearly: 0, byPlan: {} as Record<string, number> }
  });

  // Curriculum Data
  const [curriculumConfig, setCurriculumConfig] = useState<Record<string, string[]>>({});
  const [newClassInput, setNewClassInput] = useState('');
  const [selectedCurriculumClass, setSelectedCurriculumClass] = useState<string>('');
  const [newSubjectInput, setNewSubjectInput] = useState('');

  // Question Types Data
  const [questionTypes, setQuestionTypes] = useState<string[]>([]);
  const [newQTypeInput, setNewQTypeInput] = useState('');

  // Content Management Data
  const [contentPages, setContentPages] = useState<ContentPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string>('about');
  const [pageContent, setPageContent] = useState('');
  const [pageTitle, setPageTitle] = useState('');

  // Edit User State
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [originalEmail, setOriginalEmail] = useState<string>('');
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  // Create User State
  const [creatingUser, setCreatingUser] = useState<User | null>(null);

  // Delete Paper State
  const [paperToDelete, setPaperToDelete] = useState<QuestionPaper | null>(null);

  // Sample Pattern State
  const [patternClass, setPatternClass] = useState('');
  const [patternSubject, setPatternSubject] = useState('');
  const [patternText, setPatternText] = useState('');
  const [patternFile, setPatternFile] = useState<{ name: string, data: string, mimeType: string } | null>(null);
  const [syllabusFile, setSyllabusFile] = useState<{ name: string, data: string, mimeType: string } | null>(null);
  const [saveStatus, setSaveStatus] = useState('');

  // ... (existing state)

  const refreshData = async () => {
    try {
      const reqs = await StorageService.getAllRequests();
      setRequests(reqs);

      const users = await StorageService.getAllUsers();
      setAllUsers(users);

      const allPapers = await StorageService.getAllPapers();
      setPapers(allPapers);

      // ... (existing config/content loading)
      const config = await StorageService.getConfig();
      setCurriculumConfig(config);
      const qTypes = await StorageService.getQuestionTypes();
      setQuestionTypes(qTypes);
      const pages = await StorageService.getAllContentPages();
      setContentPages(pages);

      // CALC STATS
      // 1. Users by Plan
      const userCounts: Record<string, number> = {};
      users.forEach(u => {
        userCounts[u.subscriptionPlan] = (userCounts[u.subscriptionPlan] || 0) + 1;
      });

      // 2. Revenue
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      let totalRev = 0;
      let monthlyRev = 0;
      let yearlyRev = 0;
      const revByPlan: Record<string, number> = {};

      reqs.forEach(r => {
        if (r.status === SubscriptionStatus.ACTIVE) {
          totalRev += r.amount;
          revByPlan[r.plan] = (revByPlan[r.plan] || 0) + r.amount;

          const rDate = new Date(r.date);
          if (rDate.getFullYear() === currentYear) {
            yearlyRev += r.amount;
            if (rDate.getMonth() === currentMonth) {
              monthlyRev += r.amount;
            }
          }
        }
      });

      setStats({
        usersByPlan: userCounts,
        revenue: { total: totalRev, monthly: monthlyRev, yearly: yearlyRev, byPlan: revByPlan }
      });

      // ... (existing defaults)
      const classes = Object.keys(config);
      if (classes.length > 0 && !patternClass) {
        setPatternClass(classes[0]);
      }
    } catch (error) {
      console.error("Error refreshing admin data", error);
    }
  };

  // Effects & Helper Functions

  const loadPattern = async () => {
    if (!patternClass || !patternSubject) {
      setPatternText('');
      setPatternFile(null);
      setSyllabusFile(null);
      return;
    }
    const p = await StorageService.getSamplePattern(patternClass, patternSubject);
    setPatternText(p ? p.content : '');
    setPatternFile(p?.attachment ? { name: p.attachment.name, data: p.attachment.data, mimeType: p.attachment.mimeType } : null);
    setSyllabusFile(p?.syllabusAttachment ? { name: p.syllabusAttachment.name, data: p.syllabusAttachment.data, mimeType: p.syllabusAttachment.mimeType } : null);
    setSaveStatus('');
  };

  useEffect(() => {
    refreshData();
  }, [view, selectedPaper, activeTab]);

  // CMS: Load page content when selection changes
  useEffect(() => {
    if (activeTab === 'content') {
      const page = contentPages.find(p => p.id === selectedPageId);
      if (page) {
        setPageTitle(page.title);
        setPageContent(page.content);
      }
    }
  }, [selectedPageId, activeTab, contentPages]);

  // Update subject dropdown when class changes in patterns/curriculum logic
  useEffect(() => {
    if (patternClass && curriculumConfig[patternClass]) {
      const subjects = curriculumConfig[patternClass];
      if (subjects.length > 0 && (!patternSubject || !subjects.includes(patternSubject))) {
        setPatternSubject(subjects[0]);
      }
    }
  }, [patternClass, curriculumConfig]);

  // Load pattern when selecting class/subject in patterns tab
  useEffect(() => {
    if (activeTab === 'patterns') {
      loadPattern();
    }
  }, [patternClass, patternSubject, activeTab]);

  const handleApproval = async (reqId: string, approve: boolean) => {
    await StorageService.processRequest(reqId, approve);
    refreshData();
  };

  const togglePasswordVisibility = (email: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [email]: !prev[email]
    }));
  };

  const openEditModal = (u: User) => {
    setEditingUser({ ...u });
    setOriginalEmail(u.email);
  };

  const saveUserChanges = async () => {
    if (editingUser) {
      await StorageService.updateUser(editingUser, originalEmail);
      setEditingUser(null);
      refreshData();
      alert("User details updated successfully.");
    }
  };

  const openCreateModal = () => {
    setCreatingUser({
      email: '',
      name: '',
      role: UserRole.TEACHER,
      password: '',
      credits: 1, // Default 1 for Free Plan
      subscriptionPlan: SubscriptionPlan.FREE,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      mobile: '',
      city: '',
      state: '',
      schoolName: ''
    });
  };

  const saveNewUser = async () => {
    if (!creatingUser?.email || !creatingUser?.name || !creatingUser?.password) {
      alert("Please fill all required fields");
      return;
    }
    try {
      await StorageService.createUser(creatingUser);
      setCreatingUser(null);
      refreshData();
      alert("New user created successfully.");
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDeleteUser = async (u: User) => {
    if (u.email === user.email) {
      alert("You cannot delete your own admin account.");
      return;
    }
    if (window.confirm(`Are you sure you want to delete user ${u.name} (${u.email})? This action cannot be undone.`)) {
      await StorageService.deleteUser(u.email);
      refreshData();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'pattern' | 'syllabus') => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB Limit for LocalStorage safety
        alert("File too large. Please upload a PDF under 2MB.");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1]; // Remove data:application/pdf;base64, prefix
        const fileData = {
          name: file.name,
          mimeType: file.type,
          data: base64String
        };

        if (type === 'pattern') {
          setPatternFile(fileData);
        } else {
          setSyllabusFile(fileData);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSavePattern = async () => {
    if (!patternClass || !patternSubject) return alert("Please select a Class and Subject.");
    if (!patternText.trim() && !patternFile && !syllabusFile) return alert("Please provide sample text or upload a document.");

    await StorageService.saveSamplePattern({
      id: Date.now().toString(),
      classNum: patternClass,
      subject: patternSubject,
      content: patternText,
      attachment: patternFile ? {
        name: patternFile.name,
        data: patternFile.data,
        mimeType: patternFile.mimeType
      } : undefined,
      syllabusAttachment: syllabusFile ? {
        name: syllabusFile.name,
        data: syllabusFile.data,
        mimeType: syllabusFile.mimeType
      } : undefined,
      updatedAt: new Date().toISOString()
    });
    setSaveStatus('Pattern & Syllabus saved successfully!');
    setTimeout(() => setSaveStatus(''), 3000);
  };

  const handleSaveContent = async () => {
    await StorageService.savePageContent({
      id: selectedPageId,
      title: pageTitle,
      content: pageContent,
      lastUpdated: new Date().toISOString()
    });
    refreshData();
    alert("Page content saved successfully!");
  };

  const handleResetContent = async () => {
    if (window.confirm("Are you sure? This will overwrite the current content with the system default.")) {
      const defaults = await StorageService.getDefaultContentOrFetch(selectedPageId);
      if (defaults) {
        setPageTitle(defaults.title);
        setPageContent(defaults.content);
      }
    }
  };

  // Curriculum Handlers
  const handleAddClass = async () => {
    if (!newClassInput.trim()) return;
    try {
      await StorageService.addClass(newClassInput.trim());
      setNewClassInput('');
      refreshData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDeleteClass = async (className: string) => {
    if (window.confirm(`Delete Class ${className} and all its subjects?`)) {
      await StorageService.deleteClass(className);
      if (selectedCurriculumClass === className) setSelectedCurriculumClass('');
      refreshData();
    }
  };

  const handleAddSubject = async () => {
    if (!selectedCurriculumClass || !newSubjectInput.trim()) return;
    try {
      await StorageService.addSubject(selectedCurriculumClass, newSubjectInput.trim());
      setNewSubjectInput('');
      refreshData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDeleteSubject = async (subject: string) => {
    if (window.confirm(`Delete Subject ${subject} from Class ${selectedCurriculumClass}?`)) {
      await StorageService.deleteSubject(selectedCurriculumClass, subject);
      refreshData();
    }
  };

  const handleAddQType = async () => {
    if (!newQTypeInput.trim()) return;
    try {
      await StorageService.addQuestionType(newQTypeInput.trim());
      setNewQTypeInput('');
      refreshData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDeleteQType = async (type: string) => {
    if (window.confirm(`Delete Question Type "${type}"?`)) {
      await StorageService.deleteQuestionType(type);
      refreshData();
    }
  };

  const getDaysRemaining = (expiryDate?: string) => {
    if (!expiryDate) return '-';
    const now = new Date();
    const expiry = new Date(expiryDate);
    if (isNaN(expiry.getTime())) return '-';

    const diffMs = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return <span className="text-red-500 font-bold">Expired</span>;
    return <span className={diffDays < 7 ? 'text-red-500 font-bold' : 'text-green-600'}>{diffDays} Days</span>;
  };

  // Helper to get Folder Name
  const getFolderName = (email: string) => {
    const u = allUsers.find(user => user.email === email);
    if (!u) return `Unknown User (${email})`;
    return `${u.name} - ${u.schoolName || 'No School'} - ${u.state || 'No State'}`;
  };

  // Group papers by creator
  const papersByCreator = papers.reduce((acc, p) => {
    acc[p.createdBy] = acc[p.createdBy] || [];
    acc[p.createdBy].push(p);
    return acc;
  }, {} as Record<string, QuestionPaper[]>);

  if (view === 'create' || selectedPaper) {
    return (
      <ErrorBoundary>
        <PaperGenerator
          userEmail={user.email}
          existingPaper={selectedPaper || undefined}
          onClose={() => { setView('dashboard'); setSelectedPaper(null); }}
          onSuccess={() => { setView('dashboard'); setSelectedPaper(null); refreshData(); }}
        />
      </ErrorBoundary>
    );
  }

  const classList = Object.keys(curriculumConfig);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Admin Panel</h1>
        <button
          onClick={() => setView('create')}
          className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-bold flex justify-center items-center gap-2 shadow-md transition-all"
        >
          <i className="fas fa-plus"></i> Generate Paper
        </button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 border-b overflow-x-auto pb-1 no-scrollbar">
        {[
          { id: 'dashboard', label: 'Dashboard' },
          { id: 'users', label: 'All Users' },
          { id: 'papers', label: 'All Papers' },
          { id: 'patterns', label: 'Sample Patterns' },
          { id: 'curriculum', label: 'Curriculum & Config' },
          { id: 'content', label: 'Website Content' },
          { id: 'support', label: 'Support Tickets' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id as any); setSelectedFolderUser(null); }}
            className={`pb-2 px-4 font-medium whitespace-nowrap transition-colors ${activeTab === tab.id
              ? 'border-b-2 border-purple-600 text-purple-600'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl shadow-sm border p-4 sm:p-6 min-h-[500px]">

        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <h3 className="text-blue-800 font-bold text-sm uppercase">Total Revenue</h3>
                <p className="text-3xl font-bold text-blue-900 mt-2">₹{stats.revenue.total.toLocaleString()}</p>
                <p className="text-xs text-blue-600 mt-1">Lifetime</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                <h3 className="text-green-800 font-bold text-sm uppercase">Revenue (Yearly)</h3>
                <p className="text-3xl font-bold text-green-900 mt-2">₹{stats.revenue.yearly.toLocaleString()}</p>
                <p className="text-xs text-green-600 mt-1">Current Year</p>
              </div>
              <div className="bg-teal-50 p-4 rounded-lg border border-teal-100">
                <h3 className="text-teal-800 font-bold text-sm uppercase">Revenue (Monthly)</h3>
                <p className="text-3xl font-bold text-teal-900 mt-2">₹{stats.revenue.monthly.toLocaleString()}</p>
                <p className="text-xs text-teal-600 mt-1">Current Month</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                <h3 className="text-purple-800 font-bold text-sm uppercase">Total Users</h3>
                <p className="text-3xl font-bold text-purple-900 mt-2">{allUsers.length}</p>
                <p className="text-xs text-purple-600 mt-1">Registered</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* User Breakdown */}
              <div className="border rounded-lg p-6 text-gray-800">
                <h3 className="font-bold text-lg mb-4 text-gray-800">Users by Plan</h3>
                <div className="space-y-3">
                  {Object.entries(stats.usersByPlan).map(([plan, count]) => (
                    <div key={plan} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <span className="font-medium text-gray-700">{plan}</span>
                      <span className="font-bold text-gray-900">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Revenue Breakdown */}
              <div className="border rounded-lg p-6">
                <h3 className="font-bold text-lg mb-4 text-gray-800">Revenue by Plan</h3>
                <div className="space-y-3">
                  {Object.entries(stats.revenue.byPlan).map(([plan, amt]) => (
                    <div key={plan} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <span className="font-medium text-gray-700">{plan}</span>
                      <span className="font-bold text-gray-900">₹{amt.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ... (Existing Requests + Users Tabs) ... */}
        {/* REQUESTS TAB REMOVED AS PER USER REQUEST */}
        {/* 
            Note: We still load requests in refreshData() to calculate Revenue stats, 
            but we no longer show the table to manage them. 
        */}

        {activeTab === 'users' && (
          <div>
            {/* ... Users Table ... */}
            <div className="flex justify-end mb-4">
              <button
                onClick={openCreateModal}
                className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-green-700 shadow flex items-center gap-2"
              >
                <i className="fas fa-user-plus"></i> Create User
              </button>
            </div>
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="inline-block min-w-full align-middle">
                <table className="min-w-full text-left">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="p-3 text-sm font-bold text-gray-600">Name</th>
                      <th className="p-3 text-sm font-bold text-gray-600">Email</th>
                      <th className="p-3 text-sm font-bold text-gray-600">Mobile</th>
                      <th className="p-3 text-sm font-bold text-gray-600">City</th>
                      <th className="p-3 text-sm font-bold text-gray-600">State</th>
                      <th className="p-3 text-sm font-bold text-gray-600">Password</th>
                      <th className="p-3 text-sm font-bold text-gray-600">Role</th>
                      <th className="p-3 text-sm font-bold text-gray-600">Credits</th>
                      <th className="p-3 text-sm font-bold text-gray-600">Plan</th>
                      <th className="p-3 text-sm font-bold text-gray-600">Validity</th>
                      <th className="p-3 text-sm font-bold text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allUsers.map((u) => (
                      <tr key={u.email} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-medium whitespace-nowrap">{u.name}</td>
                        <td className="p-3 text-sm text-gray-600 whitespace-nowrap">{u.email}</td>
                        <td className="p-3 text-sm whitespace-nowrap">{u.mobile || '-'}</td>
                        <td className="p-3 text-sm whitespace-nowrap">{u.city || '-'}</td>
                        <td className="p-3 text-sm whitespace-nowrap">{u.state || '-'}</td>
                        <td className="p-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded w-20 truncate inline-block text-center">
                              {visiblePasswords[u.email] ? u.password || 'N/A' : '••••••••'}
                            </span>
                            <button
                              onClick={() => togglePasswordVisibility(u.email)}
                              className="text-gray-400 hover:text-blue-600"
                            >
                              <i className={`fas ${visiblePasswords[u.email] ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                            </button>
                          </div>
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span className={`text-xs px-2 py-1 rounded font-bold ${u.role === UserRole.ADMIN ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="p-3 font-bold">{u.credits}</td>
                        <td className="p-3 text-sm">{u.subscriptionPlan}</td>
                        <td className="p-3 text-sm font-mono whitespace-nowrap">{getDaysRemaining(u.subscriptionExpiryDate)}</td>
                        <td className="p-3 whitespace-nowrap flex gap-2">
                          <button
                            onClick={() => openEditModal(u)}
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1 rounded transition-colors"
                          >
                            <i className="fas fa-edit mr-1"></i> Edit
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1 rounded transition-colors"
                            title="Delete User"
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'papers' && (
          <div className="space-y-4">
            {/* If NO folder selected, show Folders */}
            {!selectedFolderUser ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.keys(papersByCreator).length === 0 && <p className="text-gray-400 col-span-3 text-center py-10">No papers generated yet.</p>}

                {Object.entries(papersByCreator).map(([email, userPapers]) => (
                  <div
                    key={email}
                    onClick={() => setSelectedFolderUser(email)}
                    className="border rounded-xl p-6 bg-yellow-50 hover:bg-yellow-100 transition-colors cursor-pointer group flex flex-col items-center text-center shadow-sm"
                  >
                    <i className="fas fa-folder text-6xl text-yellow-500 mb-4 group-hover:scale-110 transition-transform"></i>
                    <h3 className="font-bold text-gray-800 text-lg mb-1">{getFolderName(email)}</h3>
                    <p className="text-sm text-gray-500">{userPapers.length} Papers</p>
                    <p className="text-xs text-gray-400 mt-2">{email}</p>
                  </div>
                ))}
              </div>
            ) : (
              /* If Folder Selected, show Papers for that user */
              <div>
                <button
                  onClick={() => setSelectedFolderUser(null)}
                  className="mb-4 text-gray-600 hover:text-gray-900 font-medium flex items-center gap-2"
                >
                  <i className="fas fa-arrow-left"></i> Back to Folders
                </button>
                <h3 className="text-xl font-bold mb-4 border-b pb-2">
                  Papers: {getFolderName(selectedFolderUser)}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {papersByCreator[selectedFolderUser].map((p) => (
                    <div key={p.id} className="border p-4 rounded-lg bg-gray-50 flex flex-col h-full hover:shadow-md transition-shadow">
                      <h3 className="font-bold text-gray-800 line-clamp-2">{p.title}</h3>
                      <p className="text-sm text-gray-600 mb-2">Class {p.classNum} • {p.subject}</p>
                      <div className="mt-auto flex justify-between items-end">
                        <div>
                          <span className="text-xs text-gray-500">{new Date(p.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setSelectedPaper(p)}
                            className="text-blue-500 hover:text-blue-700 p-2 hover:bg-blue-50 rounded"
                            title="View/Edit Paper"
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                          <button
                            onClick={() => setPaperToDelete(p)}
                            className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded"
                            title="Delete Paper"
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'patterns' && (
          <div className="space-y-6">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <h3 className="font-bold text-blue-800 mb-2">Configure Style & Syllabus</h3>
              <p className="text-sm text-blue-600 mb-4">
                Provide a style guide and syllabus for the AI. You can paste text manually, upload a sample PDF (style), and upload a Syllabus PDF (scope).
              </p>

              {/* Dynamic Dropdowns for Sample Pattern */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Class</label>
                  <select
                    className="w-full border rounded p-2 bg-white"
                    value={patternClass}
                    onChange={(e) => setPatternClass(e.target.value)}
                  >
                    {(!Array.isArray(classList) || classList.length === 0) && <option>No classes found</option>}
                    {Array.isArray(classList) && classList.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Subject</label>
                  <select
                    className="w-full border rounded p-2 bg-white"
                    value={patternSubject}
                    onChange={(e) => setPatternSubject(e.target.value)}
                  >
                    {!patternClass || !curriculumConfig[patternClass] || !Array.isArray(curriculumConfig[patternClass]) || curriculumConfig[patternClass].length === 0 ? <option>No subjects found</option> : null}
                    {patternClass && Array.isArray(curriculumConfig[patternClass]) && curriculumConfig[patternClass].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* ... Upload inputs (Same as before) ... */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Manual Text Input */}
              <div className="lg:col-span-1">
                <label className="font-bold text-gray-700 mb-2 block">Option 1: Paste Text</label>
                <textarea
                  className="w-full h-64 p-4 border rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Paste sample questions here..."
                  value={patternText}
                  onChange={(e) => setPatternText(e.target.value)}
                ></textarea>
              </div>

              {/* Sample Paper File Upload */}
              <div className="lg:col-span-1">
                <label className="font-bold text-gray-700 mb-2 block">Option 2: Sample Paper (PDF)</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors h-64">
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => handleFileUpload(e, 'pattern')}
                    className="hidden"
                    id="pattern-file-upload"
                  />
                  <label htmlFor="pattern-file-upload" className="cursor-pointer text-center w-full">
                    <i className="fas fa-file-pdf text-4xl text-blue-400 mb-3"></i>
                    <p className="font-bold text-gray-600 mb-1">Upload Sample Paper</p>
                    <p className="text-xs text-gray-400">Max size: 2MB</p>
                  </label>

                  {patternFile && (
                    <div className="mt-4 flex items-center gap-2 bg-blue-100 px-3 py-2 rounded text-blue-800 text-sm w-full max-w-xs truncate mx-auto">
                      <i className="fas fa-file-pdf shrink-0"></i>
                      <span className="truncate">{patternFile.name}</span>
                      <button onClick={() => setPatternFile(null)} className="ml-auto text-red-500 hover:text-red-700 shrink-0">
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Syllabus File Upload */}
              <div className="lg:col-span-1">
                <label className="font-bold text-gray-700 mb-2 block">Option 3: Syllabus / Blueprint (PDF)</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors h-64">
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => handleFileUpload(e, 'syllabus')}
                    className="hidden"
                    id="syllabus-file-upload"
                  />
                  <label htmlFor="syllabus-file-upload" className="cursor-pointer text-center w-full">
                    <i className="fas fa-book text-4xl text-purple-400 mb-3"></i>
                    <p className="font-bold text-gray-600 mb-1">Upload Syllabus</p>
                    <p className="text-xs text-gray-400">Max size: 2MB</p>
                  </label>

                  {syllabusFile && (
                    <div className="mt-4 flex items-center gap-2 bg-purple-100 px-3 py-2 rounded text-purple-800 text-sm w-full max-w-xs truncate mx-auto">
                      <i className="fas fa-file-pdf shrink-0"></i>
                      <span className="truncate">{syllabusFile.name}</span>
                      <button onClick={() => setSyllabusFile(null)} className="ml-auto text-red-500 hover:text-red-700 shrink-0">
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                {saveStatus && <span className="text-green-600 text-sm font-bold animate-pulse">{saveStatus}</span>}
                <button
                  onClick={handleSavePattern}
                  className="w-full sm:w-auto bg-green-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-green-700 shadow-lg flex items-center justify-center gap-2"
                >
                  <i className="fas fa-save"></i> Save Configuration
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'curriculum' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Manage Classes */}
            <div className="border rounded-lg p-6 bg-gray-50">
              <h3 className="font-bold text-lg text-gray-800 mb-4 border-b pb-2">Manage Classes</h3>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  className="flex-1 border rounded p-2"
                  placeholder="e.g. Class IX"
                  value={newClassInput}
                  onChange={(e) => setNewClassInput(e.target.value)}
                />
                <button
                  onClick={handleAddClass}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Add
                </button>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {Array.isArray(classList) && classList.map(cls => (
                  <div key={cls} className={`flex justify-between items-center p-3 rounded border cursor-pointer ${selectedCurriculumClass === cls ? 'bg-blue-100 border-blue-400' : 'bg-white'}`} onClick={() => setSelectedCurriculumClass(cls)}>
                    <span className="font-medium">{cls}</span>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteClass(cls); }} className="text-red-400 hover:text-red-600">
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Manage Subjects */}
            <div className="border rounded-lg p-6 bg-gray-50">
              <h3 className="font-bold text-lg text-gray-800 mb-4 border-b pb-2">
                Manage Subjects {selectedCurriculumClass ? `for ${selectedCurriculumClass}` : ''}
              </h3>
              {!selectedCurriculumClass ? (
                <div className="text-center text-gray-500 py-10">Select a Class from the left to manage subjects.</div>
              ) : (
                <>
                  <div className="flex gap-2 mb-4">
                    <input
                      type="text"
                      className="flex-1 border rounded p-2"
                      placeholder="e.g. Mathematics"
                      value={newSubjectInput}
                      onChange={(e) => setNewSubjectInput(e.target.value)}
                    />
                    <button
                      onClick={handleAddSubject}
                      className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
                    >
                      Add
                    </button>
                  </div>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {Array.isArray(curriculumConfig[selectedCurriculumClass]) && curriculumConfig[selectedCurriculumClass].map(sub => (
                      <div key={sub} className="flex justify-between items-center p-3 rounded border bg-white">
                        <span>{sub}</span>
                        <button onClick={() => handleDeleteSubject(sub)} className="text-red-400 hover:text-red-600">
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    ))}
                    {(!curriculumConfig[selectedCurriculumClass] || !Array.isArray(curriculumConfig[selectedCurriculumClass]) || curriculumConfig[selectedCurriculumClass].length === 0) && (
                      <p className="text-gray-400 text-sm text-center">No subjects added yet.</p>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Manage Question Types */}
            <div className="border rounded-lg p-6 bg-gray-50">
              <h3 className="font-bold text-lg text-gray-800 mb-4 border-b pb-2">Question Types</h3>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  className="flex-1 border rounded p-2"
                  placeholder="e.g. Case Study"
                  value={newQTypeInput}
                  onChange={(e) => setNewQTypeInput(e.target.value)}
                />
                <button
                  onClick={handleAddQType}
                  className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                >
                  Add
                </button>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {Array.isArray(questionTypes) && questionTypes.map(type => (
                  <div key={type} className="flex justify-between items-center p-3 rounded border bg-white">
                    <span>{type}</span>
                    <button onClick={() => handleDeleteQType(type)} className="text-red-400 hover:text-red-600">
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'content' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1 space-y-2">
              <h3 className="font-bold text-gray-700 mb-2">Select Page</h3>
              {contentPages.map(page => (
                <button
                  key={page.id}
                  onClick={() => setSelectedPageId(page.id)}
                  className={`w-full text-left p-3 rounded border transition-colors ${selectedPageId === page.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-gray-50'}`}
                >
                  {page.title}
                </button>
              ))}
            </div>
            <div className="lg:col-span-3">
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-1">Page Title</label>
                <input
                  type="text"
                  className="w-full border rounded p-2 font-bold"
                  value={pageTitle}
                  onChange={(e) => setPageTitle(e.target.value)}
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-1">Content</label>
                <textarea
                  className="w-full h-80 p-4 border rounded bg-white"
                  value={pageContent}
                  onChange={(e) => setPageContent(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">Basic text formatting is supported. Use new lines for paragraphs.</p>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleSaveContent}
                  className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors flex justify-center items-center"
                >
                  <i className="fas fa-save mr-2"></i> Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'support' && <SupportTicketManager />}
      </div>

      {/* Edit User Modal */}
      {
        editingUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg max-w-md w-full">
              <h3 className="text-xl font-bold mb-4">Edit User</h3>
              <div className="space-y-3">
                <div><label className="text-xs font-bold text-gray-500">Name</label><input className="w-full border p-2 rounded" value={editingUser.name} onChange={e => setEditingUser({ ...editingUser, name: e.target.value })} /></div>
                <div><label className="text-xs font-bold text-gray-500">Email</label><input className="w-full border p-2 rounded" value={editingUser.email} onChange={e => setEditingUser({ ...editingUser, email: e.target.value })} /></div>
                <div><label className="text-xs font-bold text-gray-500">Mobile</label><input className="w-full border p-2 rounded" value={editingUser.mobile} onChange={e => setEditingUser({ ...editingUser, mobile: e.target.value })} /></div>
                <div><label className="text-xs font-bold text-gray-500">Credits</label><input type="number" className="w-full border p-2 rounded" value={editingUser.credits} onChange={e => setEditingUser({ ...editingUser, credits: parseInt(e.target.value) })} /></div>
                <div>
                  <label className="text-xs font-bold text-gray-500">Plan</label>
                  <select className="w-full border p-2 rounded" value={editingUser.subscriptionPlan} onChange={e => setEditingUser({ ...editingUser, subscriptionPlan: e.target.value as SubscriptionPlan })}>
                    {Object.values(SubscriptionPlan).map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500">Role</label>
                  <select className="w-full border p-2 rounded" value={editingUser.role} onChange={e => setEditingUser({ ...editingUser, role: e.target.value as UserRole })}>
                    {Object.values(UserRole).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setEditingUser(null)} className="px-4 py-2 text-gray-500">Cancel</button>
                <button onClick={saveUserChanges} className="px-4 py-2 bg-blue-600 text-white rounded font-bold">Save Changes</button>
              </div>
            </div>
          </div>
        )
      }

      {/* Create User Modal */}
      {
        creatingUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg max-w-md w-full">
              <h3 className="text-xl font-bold mb-4">Create New User</h3>
              <div className="space-y-3">
                <div><label className="text-xs font-bold text-gray-500">Name</label><input className="w-full border p-2 rounded" value={creatingUser.name} onChange={e => setCreatingUser({ ...creatingUser, name: e.target.value })} /></div>
                <div><label className="text-xs font-bold text-gray-500">Email</label><input className="w-full border p-2 rounded" value={creatingUser.email} onChange={e => setCreatingUser({ ...creatingUser, email: e.target.value })} /></div>
                <div><label className="text-xs font-bold text-gray-500">Password</label><input className="w-full border p-2 rounded" value={creatingUser.password} onChange={e => setCreatingUser({ ...creatingUser, password: e.target.value })} /></div>
                <div><label className="text-xs font-bold text-gray-500">Mobile</label><input className="w-full border p-2 rounded" value={creatingUser.mobile} onChange={e => setCreatingUser({ ...creatingUser, mobile: e.target.value })} /></div>
                <div>
                  <label className="text-xs font-bold text-gray-500">Role</label>
                  <select className="w-full border p-2 rounded" value={creatingUser.role} onChange={e => setCreatingUser({ ...creatingUser, role: e.target.value as UserRole })}>
                    {Object.values(UserRole).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setCreatingUser(null)} className="px-4 py-2 text-gray-500">Cancel</button>
                <button onClick={saveNewUser} className="px-4 py-2 bg-green-600 text-white rounded font-bold">Create User</button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

const SupportTicketManager = () => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [reply, setReply] = useState('');

  const loadTickets = async () => {
    const t = await StorageService.getAllTickets();
    t.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setTickets(t);
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const handleReply = async () => {
    if (!reply.trim()) return;
    const updated = { ...selectedTicket, adminReply: reply, status: 'RESOLVED', updatedAt: new Date().toISOString() };
    await StorageService.updateTicket(updated);
    alert("Reply sent and ticket resolved.");
    setReply('');
    setSelectedTicket(null);
    loadTickets();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
      <div className="border rounded-lg overflow-hidden flex flex-col">
        <div className="bg-gray-100 p-3 font-bold border-b flex justify-between items-center">
          <span>All Tickets</span>
          <button onClick={loadTickets} className="text-blue-600 hover:text-blue-800 text-sm"><i className="fas fa-sync-alt"></i></button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {tickets.length === 0 && <p className="text-center p-4 text-gray-500">No tickets.</p>}
          {tickets.map(t => (
            <div
              key={t.id}
              onClick={() => setSelectedTicket(t)}
              className={`p-4 border-b cursor-pointer hover:bg-blue-50 transition-colors ${selectedTicket?.id === t.id ? 'bg-blue-100 border-l-4 border-blue-600' : ''}`}
            >
              <div className="flex justify-between mb-1">
                <span className="font-bold text-gray-800 text-sm truncate w-32">{t.subject}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${t.status === 'RESOLVED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {t.status}
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-1">{t.userEmail}</p>
              <p className="text-xs text-gray-400 text-right">{new Date(t.createdAt).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="lg:col-span-2 border rounded-lg p-6 flex flex-col">
        {!selectedTicket ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            Select a ticket to view details
          </div>
        ) : (
          <>
            <div className="mb-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-gray-800">{selectedTicket.subject}</h3>
                <span className="text-sm text-gray-500">{new Date(selectedTicket.createdAt).toLocaleString()}</span>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg mb-4 text-gray-700 whitespace-pre-wrap">
                {selectedTicket.message}
              </div>
              <p className="text-sm font-bold text-gray-600 mb-1">From: <span className="text-blue-600">{selectedTicket.userEmail}</span></p>
            </div>

            <div className="mt-auto border-t pt-4">
              {selectedTicket.adminReply ? (
                <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                  <p className="font-bold text-green-800 mb-1"><i className="fas fa-check-circle"></i> Resolved</p>
                  <p className="text-green-700 text-sm">{selectedTicket.adminReply}</p>
                </div>
              ) : (
                <div>
                  <label className="font-bold text-gray-700 mb-2 block">Reply & Resolve</label>
                  <textarea
                    className="w-full border rounded-lg p-3 h-32 focus:ring-2 focus:ring-blue-500 outline-none mb-3"
                    placeholder="Type your reply here..."
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                  ></textarea>
                  <button
                    onClick={handleReply}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition-colors"
                  >
                    Send Reply
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;

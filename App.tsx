import React, { useState, useEffect } from 'react';
import { StorageService } from './services/storageService';
import { User, UserRole, SubscriptionPlan, SubscriptionStatus } from './types';
import AdminPanel from './components/AdminPanel';
import TeacherDashboard from './components/TeacherDashboard';
import { MOCK_ADMIN_EMAIL, MOCK_TEACHER_EMAIL, APP_NAME } from './constants';
import { auth } from './firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Registration State
  const [isRegistering, setIsRegistering] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [regForm, setRegForm] = useState({
    name: '',
    email: '',
    password: '',
    schoolName: '',
    mobile: '',
    city: '',
    state: ''
  });

  // Check for existing session via Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser && firebaseUser.email) {
        try {
          const u = await StorageService.getUser(firebaseUser.email);
          if (u) {
            setUser(u);
          } else {
            // Handle case where auth exists but user profile doesn't (shouldn't happen ideally)
            console.error("User profile not found for authenticated user");
            setUser(null);
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const emailToUse = loginEmail;

    if (!emailToUse || !loginPassword) {
      alert("Please enter email and password");
      return;
    }

    try {
      const u = await StorageService.login(emailToUse, loginPassword);
      setUser(u);
    } catch (error: any) {
      console.error("Login failed", error);
      alert("Login Failed: " + error.message);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!regForm.name || !regForm.email || !regForm.password || !regForm.schoolName || !regForm.mobile) {
      alert("Please fill in all required fields.");
      return;
    }

    const mobileRegex = /^[0-9]{10}$/;
    if (!mobileRegex.test(regForm.mobile)) {
      alert("Invalid Mobile Number. Please enter a valid 10-digit mobile number.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(regForm.email)) {
      alert("Invalid Email format.");
      return;
    }

    if (regForm.password.length < 6) {
      alert("Password is too short. Min 6 chars.");
      return;
    }

    try {
      const newUser: User = {
        name: regForm.name,
        email: regForm.email,
        password: regForm.password, // Note: Password stored in Auth, but keeping in object for type consistency if needed, though security wise we shouldn't store it in Firestore if possible. But for now following existing structure.
        role: UserRole.TEACHER,
        credits: 1,
        subscriptionPlan: SubscriptionPlan.FREE,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        schoolName: regForm.schoolName,
        mobile: regForm.mobile,
        city: regForm.city,
        state: regForm.state
      };

      await StorageService.createUser(newUser);

      console.log(`[System] Welcome Email sent to ${newUser.email}`);
      console.log(`[System] SMS sent to ${newUser.mobile}`);

      alert("Registration Successful! Logging you in...");
      // Auto login is handled by onAuthStateChanged usually, but we can set state if needed.
      // createUserWithEmailAndPassword automatically signs in.

    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleLogout = async () => {
    try {
      await StorageService.logout();
      setUser(null);
      setLoginEmail('');
      setLoginPassword('');
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center text-gray-500">Loading...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md space-y-6">
          <div className="text-center">
            <div className="w-20 h-20 bg-blue-900 rounded-2xl mx-auto flex items-center justify-center mb-4 text-white text-3xl font-black shadow-lg shadow-blue-200 border-4 border-blue-500 transform hover:scale-105 transition-transform duration-300">
              <span className="tracking-tighter">RKS</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">{APP_NAME}</h1>
            <p className="text-gray-500 mt-2">Intelligent Question Paper Setter</p>
          </div>

          {!isRegistering ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Email ID</label>
                <input
                  type="email"
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="teacher@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <input
                  type="password"
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••"
                />
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-md">
                Login
              </button>

              <div className="text-center text-xs text-gray-400 pt-2">
                {/* Demo links removed */}
              </div>

              <div className="pt-4 border-t text-center">
                <p className="text-sm text-gray-600">New User?</p>
                <button type="button" onClick={() => setIsRegistering(true)} className="text-blue-600 font-bold hover:underline">Register Here</button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3">
              <h2 className="text-xl font-bold text-gray-800 border-b pb-2">Teacher Registration</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500">Full Name</label>
                  <input required type="text" className="w-full p-2 border rounded" value={regForm.name} onChange={e => setRegForm({ ...regForm, name: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500">Mobile</label>
                  <input required type="text" className="w-full p-2 border rounded" value={regForm.mobile} onChange={e => { const val = e.target.value.replace(/\D/g, '').slice(0, 10); setRegForm({ ...regForm, mobile: val }); }} placeholder="10 digits" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500">School Name</label>
                <input required type="text" className="w-full p-2 border rounded" value={regForm.schoolName} onChange={e => setRegForm({ ...regForm, schoolName: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500">City</label>
                  <input required type="text" className="w-full p-2 border rounded" value={regForm.city} onChange={e => setRegForm({ ...regForm, city: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500">State</label>
                  <input required type="text" className="w-full p-2 border rounded" value={regForm.state} onChange={e => setRegForm({ ...regForm, state: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500">Email ID</label>
                <input required type="email" className="w-full p-2 border rounded" value={regForm.email} onChange={e => setRegForm({ ...regForm, email: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500">Create Password</label>
                <input required type="password" className="w-full p-2 border rounded" value={regForm.password} onChange={e => setRegForm({ ...regForm, password: e.target.value })} placeholder="Min 6 chars" />
              </div>

              <button type="submit" className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition-colors shadow-md mt-2">
                Register Now
              </button>
              <button type="button" onClick={() => setIsRegistering(false)} className="w-full text-gray-500 text-sm hover:underline mt-2">
                Cancel
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {user.role === UserRole.ADMIN ? (
        <div className="min-h-screen flex flex-col">
          <header className="bg-purple-800 text-white p-4 shadow-md flex justify-between items-center sticky top-0 z-50">
            <div className="font-bold text-lg flex items-center gap-2">
              <i className="fas fa-shield-alt"></i> Admin Panel
            </div>
            <div className="flex items-center gap-4">
              <span className="hidden sm:inline">{user.name}</span>
              <button onClick={handleLogout} className="text-purple-200 hover:text-white"><i className="fas fa-sign-out-alt"></i> Logout</button>
            </div>
          </header>
          <AdminPanel user={user} />
        </div>
      ) : (
        <TeacherDashboard user={user} onLogout={handleLogout} />
      )}
    </div>
  );
};

export default App;
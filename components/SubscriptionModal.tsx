import React, { useState } from 'react';
import { PRICING, RAZORPAY_KEY_ID, APP_NAME } from '../constants';
import { StorageService } from '../services/storageService';
import { User, SubscriptionPlan } from '../types';

interface Props {
  user: User;
  onClose: () => void;
  onSuccess: () => void;
}

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

const SubscriptionModal: React.FC<Props> = ({ user, onClose, onSuccess }) => {
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>(SubscriptionPlan.PROFESSIONAL);
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    if (!RAZORPAY_KEY_ID) {
      alert("Razorpay Key ID is missing. Please check your configuration.");
      return;
    }

    const amount = PRICING[selectedPlan].price;
    if (amount === 0) {
      // Handle Free Plan if needed, or just select
      onSuccess();
      return;
    }

    setLoading(true);

    const res = await loadRazorpayScript();
    if (!res) {
      alert("Razorpay SDK failed to load. Are you online?");
      setLoading(false);
      return;
    }

    const options = {
      key: RAZORPAY_KEY_ID,
      amount: amount * 100, // Amount in paise
      currency: "INR",
      name: APP_NAME,
      description: `Upgrade to ${PRICING[selectedPlan].label}`,
      image: "https://example.com/your_logo", // You can add a logo URL here
      handler: async (response: any) => {
        try {
          console.log("Payment Success:", response);
          // Update Backend
          await StorageService.recordSubscriptionPayment(
            user,
            selectedPlan,
            response.razorpay_payment_id,
            amount
          );
          alert("Payment Successful! Plan Upgraded.");
          onSuccess(); // Triggers refresh in App.tsx
        } catch (error) {
          console.error("Payment verification failed:", error);
          alert("Payment Successful but update failed. Please contact support.");
        } finally {
          setLoading(false);
        }
      },
      prefill: {
        name: user.name,
        email: user.email,
        contact: user.mobile || "",
      },
      theme: {
        color: "#3399cc",
      },
      modal: {
        ondismiss: () => {
          setLoading(false);
        }
      }
    };

    // @ts-ignore
    const rzp1 = new window.Razorpay(options);
    rzp1.on("payment.failed", function (response: any) {
      alert(response.error.description);
      setLoading(false);
    });

    rzp1.open();
  };


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="bg-blue-600 p-4 text-white flex justify-between items-center">
          <h2 className="text-xl font-bold">Upgrade Plan</h2>
          <button onClick={onClose}><i className="fas fa-times"></i></button>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 gap-3">
            {[SubscriptionPlan.STARTER, SubscriptionPlan.PROFESSIONAL, SubscriptionPlan.PREMIUM].map((plan) => (
              <button
                key={plan}
                onClick={() => setSelectedPlan(plan)}
                className={`p-3 border-2 rounded-lg text-left transition-all ${selectedPlan === plan ? 'border-blue-600 bg-blue-50' : 'border-gray-200'}`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-bold text-gray-800">{PRICING[plan].label}</div>
                    <div className="text-sm text-gray-500">
                      {PRICING[plan].papers} Papers • {PRICING[plan].validityDays} Days Validity
                    </div>
                  </div>
                  <div className="text-xl font-bold text-blue-600">₹{PRICING[plan].price}</div>
                </div>
              </button>
            ))}
          </div>

          <div className="flex flex-col items-center justify-center py-4 border-t">
            <button
              onClick={handlePayment}
              disabled={loading}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition-colors flex justify-center items-center gap-2"
            >
              {loading ? (
                <>Processing...</>
              ) : (
                <>
                  <span>Pay Now</span>
                  <span className="bg-white text-green-600 px-2 py-0.5 rounded text-sm">₹{PRICING[selectedPlan].price}</span>
                </>
              )}
            </button>
          </div>

          <p className="text-xs text-center text-gray-500">
            Secure payment via Razorpay. Your plan will be activated automatically upon successful backend verification.
          </p>
        </div>
      </div>
    </div>
  );
};


export default SubscriptionModal;

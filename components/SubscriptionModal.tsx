
import React, { useState } from 'react';
import { PRICING, UPI_QR_IMAGE } from '../constants';
import { StorageService } from '../services/storageService';
import { User, SubscriptionPlan } from '../types';

interface Props {
  user: User;
  onClose: () => void;
  onSuccess: () => void;
}

// Helper component for Razorpay Button
const RazorpayButton = ({ paymentButtonId }: { paymentButtonId: string }) => {
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    // Clear previous scripts if any inside this container to avoid duplicates if re-rendered
    if (formRef.current) {
      formRef.current.innerHTML = '';
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/payment-button.js";
    script.setAttribute("data-payment_button_id", paymentButtonId);
    script.async = true;

    if (formRef.current) {
      formRef.current.appendChild(script);
    }
  }, [paymentButtonId]);

  return <form ref={formRef}></form>;
};

const SubscriptionModal: React.FC<Props> = ({ user, onClose, onSuccess }) => {
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>(SubscriptionPlan.PROFESSIONAL);

  const getButtonId = (plan: SubscriptionPlan) => {
    switch (plan) {
      case SubscriptionPlan.STARTER: return 'pl_RtXC8qnF4cC8u3';
      case SubscriptionPlan.PROFESSIONAL: return 'pl_RtXNnM8pojWMWw';
      case SubscriptionPlan.PREMIUM: return 'pl_RtXQ5JOdVYRknI';
      default: return '';
    }
  };

  const buttonId = getButtonId(selectedPlan);

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
                    <div className="text-sm text-gray-500">{PRICING[plan].papers} Papers</div>
                  </div>
                  <div className="text-xl font-bold text-blue-600">₹{PRICING[plan].price}</div>
                </div>
              </button>
            ))}
          </div>

          <div className="flex flex-col items-center justify-center py-4 border-t">
            {buttonId ? (
              <div key={buttonId}>
                {/* Key property forces re-mount of component when buttonID changes, ensuring script re-runs */}
                <RazorpayButton paymentButtonId={buttonId} />
              </div>
            ) : (
              <p className="text-red-500">Select a valid plan to pay.</p>
            )}
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

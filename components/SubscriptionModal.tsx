
import React, { useState } from 'react';
import { PRICING, UPI_QR_IMAGE } from '../constants';
import { StorageService } from '../services/storageService';
import { User, SubscriptionPlan } from '../types';

interface Props {
  user: User;
  onClose: () => void;
  onSuccess: () => void;
}

const SubscriptionModal: React.FC<Props> = ({ user, onClose, onSuccess }) => {
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>(SubscriptionPlan.PROFESSIONAL);
  const [proof, setProof] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.7)); // Compress to 70% quality jpeg
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("File size too large. Please upload an image smaller than 5MB.");
        return;
      }
      try {
        const resizedImage = await resizeImage(file);
        setProof(resizedImage);
      } catch (error) {
        console.error("Error resizing image", error);
        alert("Failed to process image. Please try another one.");
      }
    }
  };

  const handleSubmit = async () => {
    if (!proof) return alert("Please upload payment screenshot");
    setIsSubmitting(true);
    try {
      await StorageService.createPaymentRequest(user.email, selectedPlan, proof);
      alert("Payment submitted for approval!");
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Payment submission failed", error);
      alert("Failed to submit payment request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="bg-blue-600 p-4 text-white flex justify-between items-center"><h2 className="text-xl font-bold">Upgrade Plan</h2><button onClick={onClose}><i className="fas fa-times"></i></button></div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 gap-3">
            {[SubscriptionPlan.STARTER, SubscriptionPlan.PROFESSIONAL, SubscriptionPlan.PREMIUM].map((plan) => (
              <button key={plan} onClick={() => setSelectedPlan(plan)} className={`p-3 border-2 rounded-lg text-left transition-all ${selectedPlan === plan ? 'border-blue-600 bg-blue-50' : 'border-gray-200'}`}>
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
          <div className="flex flex-col items-center space-y-2">
            <p className="text-sm text-gray-600">Scan to pay via UPI</p>
            <img src={UPI_QR_IMAGE} alt="UPI QR" className="w-32 h-32 border rounded-lg" />
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-2">Upload Payment Screenshot</label><input type="file" accept="image/*" onChange={handleFileChange} className="block w-full text-sm text-gray-500" /></div>
          <button onClick={handleSubmit} disabled={!proof || isSubmitting} className={`w-full py-3 rounded-lg font-bold text-white ${proof && !isSubmitting ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400'}`}>
            {isSubmitting ? 'Submitting...' : 'Submit for Approval'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionModal;

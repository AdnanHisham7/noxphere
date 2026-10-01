// src/utils/razorpay.ts

export const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && (window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export interface RazorpayCheckoutOptions {
  key: string;
  amount: number; // in paise
  currency?: string;
  name: string;
  description?: string;
  order_id: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, any>;
  theme?: {
    color?: string;
  };
}

export interface RazorpayPaymentSuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export const openRazorpayCheckout = async (
  options: RazorpayCheckoutOptions
): Promise<RazorpayPaymentSuccessResponse> => {
  const loaded = await loadRazorpayScript();
  if (!loaded) {
    throw new Error("Failed to load Razorpay payment SDK. Check your internet connection.");
  }

  return new Promise((resolve, reject) => {
    const rzpOptions = {
      ...options,
      currency: options.currency || "INR",
      handler: function (response: RazorpayPaymentSuccessResponse) {
        resolve(response);
      },
      modal: {
        ondismiss: function () {
          reject(new Error("Payment cancelled by user"));
        },
      },
    };

    const rzp = new (window as any).Razorpay(rzpOptions);
    rzp.on("payment.failed", function (response: any) {
      reject(new Error(response?.error?.description || "Payment failed"));
    });
    rzp.open();
  });
};

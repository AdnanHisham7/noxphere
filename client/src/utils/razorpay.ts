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
  amount: number; // in paise / smallest currency unit
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
  config?: any;
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
    const isINR = (options.currency || "INR").toUpperCase() === "INR";

    const rzpOptions: any = {
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

    // For INR transactions, prioritize UPI (Google Pay, PhonePe, Paytm, QR) so it appears prominently
    if (isINR) {
      rzpOptions.config = {
        display: {
          blocks: {
            upi: {
              name: "Pay using UPI (Google Pay, PhonePe, Paytm, QR)",
              instruments: [
                {
                  method: "upi",
                },
              ],
            },
            other: {
              name: "Cards, Netbanking & Other Methods",
              instruments: [
                {
                  method: "card",
                },
                {
                  method: "netbanking",
                },
                {
                  method: "wallet",
                },
              ],
            },
          },
          sequence: ["block.upi", "block.other"],
          preferences: {
            show_default_blocks: true,
          },
        },
      };
    }

    const rzp = new (window as any).Razorpay(rzpOptions);
    rzp.on("payment.failed", function (response: any) {
      reject(new Error(response?.error?.description || "Payment failed"));
    });
    rzp.open();
  });
};

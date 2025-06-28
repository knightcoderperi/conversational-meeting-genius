
export const loadRazorpay = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    const existingScript = document.getElementById('razorpay-script');
    
    if (existingScript) {
      if ((window as any).Razorpay) {
        resolve((window as any).Razorpay);
      } else {
        existingScript.addEventListener('load', () => {
          resolve((window as any).Razorpay);
        });
      }
      return;
    }

    const script = document.createElement('script');
    script.id = 'razorpay-script';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    
    script.onload = () => {
      resolve((window as any).Razorpay);
    };
    
    script.onerror = () => {
      reject(new Error('Failed to load Razorpay script'));
    };
    
    document.head.appendChild(script);
  });
};

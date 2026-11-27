import React, { useEffect } from 'react';

export const AdsterraNativeBanner: React.FC = () => {
  useEffect(() => {
    const scriptSrc = 'https://bauval.org/21/f624601a06cfb65319aa45d8f639311c';
    if (document.querySelector(`script[src="${scriptSrc}"]`)) return;

    const script = document.createElement('script');
    script.async = true;
    script.setAttribute('data-cfasync', 'false');
    script.src = scriptSrc;
    document.body.appendChild(script);
  }, []);

  return (
    <div className="w-full overflow-hidden rounded-xl my-4">
      <div id="container-f624601a06cfb65319aa45d8f639311c" />
    </div>
  );
};

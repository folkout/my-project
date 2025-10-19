import { useEffect } from "react";

const AdComponent = () => {
  useEffect(() => {
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  }, []);

  return (
    <div className="ad-container">
      <ins
        className="adsbygoogle"
        style={{ display: "block", width: "100%", height: "auto" }}
        data-ad-client="ca-pub-8239045224535743"
        data-ad-slot="1653641833"
        data-ad-format="auto"
        data-full-width-responsive="true"
      ></ins>
    </div>
  );
};

export default AdComponent;

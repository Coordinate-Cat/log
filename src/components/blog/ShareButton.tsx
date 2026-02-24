import { useState } from "react";
interface Props {
  title: string;
  url: string;
  ogImage: string;
}

export function ShareButton({ title, url, ogImage }: Props) {
  const [label, setLabel] = useState("↑ Share");

  async function handleShare() {
    // Try Web Share API with image file (works on iOS Safari / Android Chrome)
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        const res = await fetch(ogImage);
        const blob = await res.blob();
        const file = new File([blob], "og.png", { type: "image/png" });

        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title, url });
          return;
        }

        // canShare without files — share URL only
        await navigator.share({ title, url });
        return;
      } catch (e) {
        // User cancelled or error — fall through to clipboard
        if ((e as DOMException).name === "AbortError") return;
      }
    }

    // Fallback: copy URL to clipboard
    try {
      await navigator.clipboard.writeText(url);
      setLabel("Copied!");
      setTimeout(() => setLabel("↑ Share"), 2000);
    } catch {
      // Last resort
      prompt("Copy this URL:", url);
    }
  }

  return (
    <button
      onClick={handleShare}
      className="text-md m-0 cursor-pointer border-none bg-transparent p-0 font-bold text-white underline hover:text-[#00ff3c]"
    >
      {label}
    </button>
  );
}

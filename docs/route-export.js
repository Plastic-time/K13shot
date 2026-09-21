(function () {
  "use strict";

  let busy = false;
  const imageCache = new Map();

  function readDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("图片读取失败"));
      reader.readAsDataURL(blob);
    });
  }

  async function embedImage(url) {
    if (url.startsWith("data:")) return url;
    if (!imageCache.has(url)) {
      const pending = (async () => {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            // Reload avoids a cached no-CORS image response being reused for export.
            const response = await fetch(url, {
              mode: "cors", cache: "reload", signal: AbortSignal.timeout(15000),
            });
            if (!response.ok) throw new Error("HTTP " + response.status);
            const blob = await response.blob();
            if (!blob.type.startsWith("image/")) throw new Error("无效图片");
            return await readDataUrl(blob);
          } catch (error) {
            if (attempt === 1) throw error;
          }
        }
      })();
      imageCache.set(url, pending);
      pending.catch(() => imageCache.delete(url));
    }
    return imageCache.get(url);
  }

  async function embedImages(root) {
    const images = [...root.querySelectorAll("img")];
    let index = 0;
    const failed = [];
    await Promise.all(Array.from({ length: Math.min(8, images.length) }, async () => {
      while (index < images.length) {
        const img = images[index++];
        try {
          img.src = await embedImage(img.src);
          img.removeAttribute("srcset");
          img.loading = "eager";
          await img.decode();
        } catch {
          failed.push(img);
        }
      }
    }));
    if (failed.length) throw new Error(failed.length + " 张载具图片未能读取，请检查网络后重试");
  }

  async function render(payload, source, drawConnections) {
    if (busy) throw new Error("正在生成科技树截图，请稍候");
    if (!source || !window.htmlToImage) throw new Error("科技树或截图组件尚未载入");
    busy = true;
    let host;
    try {
      // Snapshot before awaiting assets so later UI changes cannot alter this export.
      const tree = source.cloneNode(true);
      const width = Math.ceil(Math.max(source.scrollWidth, source.getBoundingClientRect().width));
      tree.style.width = width + "px";
      tree.style.minWidth = width + "px";
      host = document.createElement("div");
      host.inert = true;
      host.setAttribute("aria-hidden", "true");
      Object.assign(host.style, { position: "fixed", left: "-100000px", top: "0", width: width + "px", pointerEvents: "none" });
      const sheet = document.createElement("div");
      sheet.className = "tree-screenshot";
      sheet.style.width = width + "px";
      const header = document.createElement("header");
      header.className = "tree-screenshot-header";
      const title = document.createElement("strong");
      title.textContent = payload.country + " · " + payload.type + " 科技树";
      const budget = document.createElement("span");
      budget.textContent = "待研发 " + payload.pendingCount + " 辆 · " + payload.rpLabel + " " + payload.totalRp + " · " + payload.slLabel + " " + payload.totalSl;
      header.append(title, budget);
      sheet.append(header, tree);
      host.append(sheet);
      document.body.append(host);
      // Draw immediately against the same unit state as the snapshot, including on mobile.
      drawConnections?.(tree);
      await document.fonts.ready;
      await embedImages(tree);
      const height = Math.ceil(sheet.scrollHeight);
      const scale = Math.min(1, 16000 / width, 16000 / height, Math.sqrt(32000000 / (width * height)));
      const canvas = await window.htmlToImage.toCanvas(sheet, {
        width, height, pixelRatio: scale, backgroundColor: "#edf0ed",
        skipAutoScale: true,
      });
      if (!canvas.width || !canvas.height) throw new Error("科技树截图尺寸无效");
      return canvas;
    } finally {
      host?.remove();
      busy = false;
    }
  }

  async function download(payload, source, drawConnections) {
    const canvas = await render(payload, source, drawConnections);
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(value => value ? resolve(value) : reject(new Error("截图生成失败")), "image/png");
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = (payload.filename || "war-thunder-tree.png").replace("route-", "tree-");
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    return { canvas, blob };
  }

  window.RouteExporter = { render, download, isBusy: () => busy };
})();

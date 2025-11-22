
/**
 * Removes a specific solid background color (default pure green #00FF00) from an image Data URL.
 * Returns a new Data URL with a transparent background.
 */
export const removeBackground = (
    imageDataUrl: string, 
    targetColor: { r: number, g: number, b: number } = { r: 0, g: 255, b: 0 }, // Green Screen
    tolerance: number = 100
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
  
        canvas.width = img.width;
        canvas.height = img.height;
  
        ctx.drawImage(img, 0, 0);
        
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        const { r, g, b } = targetColor;
  
        // Simple Chroma Key
        for (let i = 0; i < data.length; i += 4) {
          const currentR = data[i];
          const currentG = data[i + 1];
          const currentB = data[i + 2];
  
          // Calculate Euclidean distance in RGB space
          const distance = Math.sqrt(
            Math.pow(currentR - r, 2) +
            Math.pow(currentG - g, 2) +
            Math.pow(currentB - b, 2)
          );
  
          if (distance < tolerance) {
            data[i + 3] = 0; // Set Alpha to 0
          }
        }
  
        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = imageDataUrl;
    });
  };

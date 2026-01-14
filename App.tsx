
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { PhotoData, GeneratedImage, AppStatus } from './types';
import { generateColoringPage } from './services/geminiService';
import { jsPDF } from 'jspdf';

// --- Sub-components ---

const Header: React.FC = () => (
  <header className="sticky top-0 z-50 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md border-b border-[#f3f0e7] dark:border-[#3a3525] px-6 py-4">
    <div className="max-w-[1200px] mx-auto flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="size-8 text-primary" aria-hidden="true">
          <svg fill="currentColor" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <path d="M44 11.2727C44 14.0109 39.8386 16.3957 33.69 17.6364C39.8386 18.877 44 21.2618 44 24C44 26.7382 39.8386 29.123 33.69 30.3636C39.8386 31.6043 44 33.9891 44 36.7273C44 40.7439 35.0457 44 24 44C12.9543 44 4 40.7439 4 36.7273C4 33.9891 8.16144 31.6043 14.31 30.3636C8.16144 29.123 4 26.7382 4 24C4 21.2618 8.16144 18.877 14.31 17.6364C8.16144 16.3957 4 14.0109 4 11.2727C4 7.25611 12.9543 4 24 4C35.0457 4 44 7.25611 44 11.2727Z"></path>
          </svg>
        </div>
        <a href="/" className="text-2xl font-black tracking-tight" aria-label="Pintatina Inicio">Pintatina</a>
      </div>
    </div>
  </header>
);

// LoadingCard component to show during generation
const LoadingCard: React.FC<{ index: number }> = ({ index }) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-background-light dark:bg-background-dark/50">
    <div className="relative w-16 h-16 mb-4">
      <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
      <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      <div className="absolute inset-0 flex items-center justify-center text-primary font-bold text-xs">
        {index + 1}
      </div>
    </div>
    <span className="text-[10px] font-bold uppercase tracking-widest text-primary animate-pulse">Generando...</span>
    <div className="w-24 h-1 bg-gray-100 dark:bg-gray-800 rounded-full mt-3 overflow-hidden">
      <div className="h-full bg-primary animate-[loading-bar_2s_linear_infinite]"></div>
    </div>
  </div>
);

const FAQ_DATA = [
  {
    question: "¿Cómo funciona Pintatina?",
    answer: "Es magia tecnológica. Subes tus fotos (hasta 4), escribes una descripción mencionando las fotos con @img1, @img2... y nuestra IA generará 10 versiones únicas en blanco y negro listas para imprimir y colorear."
  },
  {
    question: "¿Qué tipo de fotos debo subir?",
    answer: "Para mejores resultados, usa fotos en primer plano donde se vea bien la cara de la persona o mascota. Evita fotos muy oscuras o borrosas."
  },
  {
    question: "¿Es seguro para los niños?",
    answer: "Totalmente. Nuestra IA está diseñada para crear contenido apto para todas las edades. No guardamos tus fotos de manera permanente y tu privacidad es nuestra prioridad."
  },
  {
    question: "¿Puedo imprimir los dibujos?",
    answer: "¡Claro! Al terminar, puedes descargar un PDF optimizado para impresión en tamaño A4 con todos tus dibujos. También te lo enviamos por correo."
  },
  {
    question: "¿Cuánto tarda la generación?",
    answer: "La IA trabaja rápido, pero crear 10 obras de arte personalizadas toma tiempo. El proceso suele completarse en unos 2 minutos."
  },
  {
    question: "¿Qué pasa si un dibujo sale mal?",
    answer: "A veces la IA tiene un mal día. Si alguna imagen da error o no se genera, aparecerá un botón de 'Reintentar fallidos' para que puedas completarlo sin coste."
  }
];

// Technical and compositional modifiers to create variety WITHOUT changing the user's theme
const IMAGE_MODIFIERS = [
  "Wide-angle shot with simple background",
  "Close-up portrait focus on the subjects",
  "Dynamic perspective from a slightly low angle",
  "Clean bold outlines with balanced composition",
  "Classic storybook style framing",
  "Detailed line work for a richer page",
  "Subject in a full-body action pose",
  "Medium-shot with centered composition",
  "Simplified artistic sketch style",
  "Professional high-contrast line art"
];

export default function App() {
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<AppStatus>('input');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFAQModalOpen, setIsFAQModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [emailSentSuccessfully, setEmailSentSuccessfully] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [pdfCount, setPdfCount] = useState<number>(() => {
    const saved = localStorage.getItem('pintatina_pdf_count');
    return saved ? parseInt(saved, 10) : 1245;
  });
  const [isCounterAnimating, setIsCounterAnimating] = useState(false);

  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>(
    Array.from({ length: 10 }, (_, i) => ({ id: `img-${i}`, url: '', status: 'pending' }))
  );

  const [mentionMenuOpen, setMentionMenuOpen] = useState(false);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('pintatina_pdf_count', pdfCount.toString());
  }, [pdfCount]);

  useEffect(() => {
    if (showSuccessToast) {
      const timer = setTimeout(() => setShowSuccessToast(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessToast]);

  const validateEmail = (email: string) => {
    return String(email)
      .toLowerCase()
      .match(
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
      );
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files) as File[];
      const remainingSlots = 4 - photos.length;
      const filesToAdd = newFiles.slice(0, remainingSlots);

      const newPhotos = filesToAdd.map((file: File) => ({
        id: Math.random().toString(36).substr(2, 9),
        url: URL.createObjectURL(file),
        file
      }));

      setPhotos(prev => [...prev, ...newPhotos]);
      setValidationError(null);
    }
  };

  const removePhoto = (id: string) => {
    setPhotos(prev => prev.filter(p => p.id !== id));
  };

  const handlePayAndGenerate = () => {
    const isEmailValid = email && validateEmail(email);
    
    if (photos.length === 0 || !description.trim() || !email.trim() || !isEmailValid) {
      setValidationError("Asegúrate de subir al menos una foto, agregar una descripción y proporcionar tu correo electrónico.");
      setTimeout(() => setValidationError(null), 6000);
      return;
    }
    
    setValidationError(null);
    setIsModalOpen(true);
  };

  const handleSendEmail = async (isAuto = false) => {
    if (!email || !validateEmail(email)) return;
    setIsSendingEmail(true);
    await new Promise(resolve => setTimeout(resolve, 3000));
    setIsSendingEmail(false);
    setEmailSentSuccessfully(true);
    if (!isAuto) {
      alert(`¡PDF enviado con éxito a ${email}! Revisa tu correo.`);
    }
  };

  const startGeneration = async () => {
    setIsModalOpen(false);
    setStatus('processing');
    setIsGenerating(true);
    setEmailSentSuccessfully(false);
    setShowSuccessToast(false);
    
    setPdfCount(prev => prev + 1);
    setIsCounterAnimating(true);
    setTimeout(() => setIsCounterAnimating(false), 1000);

    window.scrollTo({ top: (document.getElementById('results-section')?.offsetTop || 0) - 100, behavior: 'smooth' });

    const newGenerated = [...generatedImages];
    const photoFiles = photos.map(p => p.file);
    
    for (let i = 0; i < 10; i++) {
      newGenerated[i].status = 'loading';
      setGeneratedImages([...newGenerated]);

      try {
        // Construct prompt using technical variation instead of thematic modifier
        const variantDescription = `Coloring page for children: ${description}. Variation: ${IMAGE_MODIFIERS[i]}. Remember: Pure black and white line art only, STRICTLY follow user description.`;
        const resultUrl = await generateColoringPage(photoFiles, variantDescription);
        newGenerated[i].url = resultUrl;
        newGenerated[i].status = 'completed';
      } catch (error) {
        console.error(`Generation failed for image ${i}:`, error);
        newGenerated[i].status = 'error';
      }
      setGeneratedImages([...newGenerated]);
    }

    setStatus('completed');
    setIsGenerating(false);
    setShowSuccessToast(true);

    if (newGenerated.some(img => img.status === 'completed')) {
      handleSendEmail(true);
    }
  };

  const handleRetry = async () => {
    setIsGenerating(true);
    setShowSuccessToast(false);
    const newGenerated = [...generatedImages];
    const photoFiles = photos.map(p => p.file);

    for (let i = 0; i < 10; i++) {
      if (newGenerated[i].status === 'error' || newGenerated[i].status === 'pending') {
        newGenerated[i].status = 'loading';
        setGeneratedImages([...newGenerated]);

        try {
          const variantDescription = `Coloring page: ${description}. View variant: ${IMAGE_MODIFIERS[i]}. Strictly pure black and white line art.`;
          const resultUrl = await generateColoringPage(photoFiles, variantDescription);
          newGenerated[i].url = resultUrl;
          newGenerated[i].status = 'completed';
        } catch (error) {
          console.error(`Retry failed for image ${i}:`, error);
          newGenerated[i].status = 'error';
        }
        setGeneratedImages([...newGenerated]);
      }
    }
    setIsGenerating(false);
    setShowSuccessToast(true);
  };

  const generatePDFBlob = async (): Promise<jsPDF | null> => {
    const completedImages = generatedImages.filter(img => img.status === 'completed');
    if (completedImages.length === 0) return null;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const maxWidth = pageWidth - (margin * 2);
    const maxHeight = pageHeight - (margin * 2);

    for (let i = 0; i < completedImages.length; i++) {
      const img = completedImages[i];
      if (i > 0) doc.addPage();
      
      let imgWidth = maxWidth;
      let imgHeight = imgWidth * (4/3);
      if (imgHeight > maxHeight) {
        imgHeight = maxHeight;
        imgWidth = imgHeight * (3/4);
      }
      const x = (pageWidth - imgWidth) / 2;
      const y = (pageHeight - imgHeight) / 2;

      doc.addImage(img.url, 'PNG', x, y, imgWidth, imgHeight, undefined, 'FAST');
      
      doc.setFontSize(8);
      doc.setTextColor(180);
      doc.text('Generado con Pintatina.com', pageWidth / 2, pageHeight - 5, { align: 'center' });
    }
    
    return doc;
  };

  const handleDownloadPDF = async () => {
    if (isExporting) return;
    setIsExporting(true);
    setTimeout(async () => {
      try {
        const doc = await generatePDFBlob();
        if (doc) {
          doc.save(`Pintatina_Coleccion_${new Date().getTime()}.pdf`);
        } else {
          alert("No hay dibujos listos para descargar.");
        }
      } catch (error) {
        console.error("PDF generation error:", error);
        alert("Hubo un error al preparar el PDF. Por favor, inténtalo de nuevo.");
      } finally {
        setIsExporting(false);
      }
    }, 100);
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const cursor = e.target.selectionStart;
    descriptionRef.current && (descriptionRef.current.style.height = 'auto', descriptionRef.current.style.height = descriptionRef.current.scrollHeight + 'px');
    setDescription(val);
    setValidationError(null);
    
    const textBeforeCursor = val.slice(0, cursor);
    const lastChar = textBeforeCursor[textBeforeCursor.length - 1];
    
    if (lastChar === '@') {
      setMentionMenuOpen(true);
    } else if (!textBeforeCursor.includes('@') || lastChar === ' ') {
      setMentionMenuOpen(false);
    }
  };

  const insertMention = (tag: string) => {
    if (!descriptionRef.current) return;
    const cursor = descriptionRef.current.selectionStart;
    const val = description;
    
    const textBeforeCursor = val.slice(0, cursor);
    const lastAtIdx = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIdx === -1) return;

    const textBefore = val.slice(0, lastAtIdx); 
    const textAfter = val.slice(cursor);
    const newVal = textBefore + tag + " " + textAfter;
    
    setDescription(newVal);
    setMentionMenuOpen(false);
    
    setTimeout(() => {
      descriptionRef.current?.focus();
      const newPos = lastAtIdx + tag.length + 1;
      descriptionRef.current?.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const formattedCount = new Intl.NumberFormat('es-ES').format(pdfCount);
  const completedCount = generatedImages.filter(img => img.status === 'completed').length;
  const progressPercentage = (completedCount / 10) * 100;
  const hasErrors = generatedImages.some(img => img.status === 'error');

  return (
    <div className="min-h-screen font-display">
      <Header />

      <main className="max-w-[1200px] mx-auto px-6 py-12" role="main">
        {/* Hero Section */}
        <section className="mb-24 lg:mb-32 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center" aria-labelledby="hero-title">
          <div className="text-center lg:text-left flex flex-col gap-6">
            <h1 id="hero-title" className="text-4xl md:text-6xl font-black leading-tight tracking-tight">
              Convierte fotos en <span className="text-primary">dibujos para colorear</span>
            </h1>
            
            <div className="flex flex-col md:flex-row items-center lg:items-start gap-3">
              <div className={`flex items-center gap-2 bg-white dark:bg-[#2d291e] px-4 py-2 rounded-full border border-[#f3f0e7] dark:border-[#3a3525] shadow-sm transition-all duration-500 ${isCounterAnimating ? 'scale-110 border-primary/50' : 'scale-100'}`}>
                <div className="flex -space-x-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="size-6 rounded-full border-2 border-white dark:border-[#2d291e] bg-gray-200 overflow-hidden">
                      <img src={`https://i.pravatar.cc/100?img=${i + 10}`} alt="Padre" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
                <p className="text-sm font-medium">
                  <span className={`text-primary font-black transition-all ${isCounterAnimating ? 'text-lg' : 'text-base'}`}>{formattedCount}</span>
                  <span className="text-gray-500 dark:text-gray-400"> padres ya han generado dibujos</span>
                </p>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-green-500/10 text-green-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                En directo
              </div>
            </div>

            <p className="text-[#9b874b] dark:text-[#cbb87b] text-lg max-w-2xl mx-auto lg:mx-0">
              Sube fotos de tus hijos, mascotas o familia y recibe 10 páginas variadas y seguras listas para imprimir. El regalo más creativo y personalizado.
            </p>
          </div>

          <div className="relative h-[250px] md:h-[350px] flex items-center justify-center pointer-events-none select-none overflow-visible">
            <div className="relative w-full max-w-[500px] h-full flex items-center justify-center">
              <div className="absolute left-0 w-[52%] aspect-[3/4] rounded-2xl overflow-hidden shadow-xl border-4 border-white dark:border-[#3a3525] rotate-[-5deg] z-10 transition-all duration-500 pointer-events-auto hover:rotate-0 hover:z-40">
                <img 
                  src="https://lasucursaldigital.com/wp-content/uploads/2026/01/pintatina-img-b2.webp" 
                  alt="Foto original" 
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 left-3 bg-black/70 text-white text-[9px] font-black px-3 py-1.5 rounded-full backdrop-blur-md uppercase tracking-wider">
                  Foto Original
                </div>
              </div>

              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 hidden md:block">
                 <div className="bg-primary text-black p-4 rounded-full shadow-[0_0_35px_rgba(255,129,37,0.8)] animate-pulse flex items-center justify-center border-4 border-white dark:border-[#3a3525]">
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M19,9L17.75,11.75L15,13L17.75,14.25L19,17L20.25,14.25L23,13L20.25,11.75L19,9M11.5,9.5L9,4L6.5,9.5L1,12L6.5,14.5L9,20L11.5,14.5L17,12L11.5,9.5M19,1L17.75,3.75L15,5L17.75,6.25L19,9L20.25,6.25L23,5L20.25,3.75L19,1Z" />
                    </svg>
                 </div>
              </div>

              <div className="absolute right-0 w-[52%] aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl border-4 border-white dark:border-[#3a3525] rotate-[5deg] z-20 transition-all duration-500 pointer-events-auto hover:rotate-0 hover:z-40">
                <img 
                  src="https://lasucursaldigital.com/wp-content/uploads/2026/01/pintatina-img-b1.webp" 
                  alt="Resultado de imagen" 
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 right-3 bg-primary text-black text-[9px] font-black px-3 py-1.5 rounded-full shadow-lg uppercase tracking-wider">
                  Imagen
                </div>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[8px] font-bold text-gray-400 opacity-80 bg-white/70 px-2 py-0.5 rounded backdrop-blur-sm">
                  Pintatina.com
                </div>
              </div>
              
              <div className="absolute inset-0 bg-primary/5 rounded-full blur-[90px] -z-10 transform scale-110"></div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-20 relative z-10">
          <div className="flex flex-col gap-6 bg-white dark:bg-[#2d291e] p-6 rounded-xl shadow-sm border border-[#f3f0e7] dark:border-[#3a3525]">
            <div className="flex items-start gap-3">
              <span className="step-number" aria-hidden="true">1</span>
              <h3 className="text-lg font-bold leading-tight">Sube tus fotos</h3>
            </div>
            <p className="text-xs text-[#9b874b]">Sube hasta 4 fotos para usar como referencia. (Procura que se vean bien sus rostros)</p>
            <div className="grid grid-cols-2 gap-2">
              {photos.map((photo, index) => (
                <div key={photo.id} className="relative group aspect-square rounded-lg bg-center bg-cover border border-[#f3f0e7] dark:border-[#3a3525]" style={{ backgroundImage: `url(${photo.url})` }} aria-label={`Foto subida ${index + 1}`}>
                  <div className="absolute top-1 left-1 bg-black/70 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                    @img{index + 1}
                  </div>
                  <button onClick={() => removePhoto(photo.id)} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Eliminar foto">
                    <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </button>
                </div>
              ))}
              {photos.length < 4 && (
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  className="aspect-square rounded-lg bg-background-light dark:bg-background-dark flex flex-col items-center justify-center border-2 border-dashed border-[#d1d5db] dark:border-[#4a4535] cursor-pointer hover:border-primary hover:bg-primary/5 transition-all group overflow-hidden" 
                  aria-label="Subir nueva foto"
                >
                  <div className="relative mb-1">
                    <svg className="w-10 h-10 text-gray-300 group-hover:text-primary transition-all duration-300 group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <div className="absolute -top-1 -right-1 bg-primary text-white rounded-full w-4 h-4 flex items-center justify-center group-hover:rotate-90 transition-transform">
                      <span className="text-[12px] font-black leading-none">+</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 group-hover:text-primary transition-colors mt-1">Subir Foto</span>
                  <input type="file" className="hidden" ref={fileInputRef} onChange={handlePhotoUpload} multiple accept="image/*" />
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-6 bg-white dark:bg-[#2d291e] p-6 rounded-xl shadow-sm border border-[#f3f0e7] dark:border-[#3a3525] relative">
            <div className="flex items-start gap-3">
              <span className="step-number" aria-hidden="true">2</span>
              <h3 className="text-lg font-bold leading-tight">Descripción</h3>
            </div>
            <p className="text-xs text-[#9b874b]">Escribe @ para citar tus fotos. (Usa palabras como: Imágenes variadas, ropa diferente para tener mejores resultados)</p>
            <div className="relative flex-1 flex flex-col">
              <textarea 
                ref={descriptionRef}
                className="w-full flex-1 min-h-[120px] bg-background-light dark:bg-background-dark border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary placeholder:text-gray-400 resize-none"
                placeholder="Ejemplo: @img1 vestido de superhéroe volando sobre @img2..."
                value={description}
                onChange={handleDescriptionChange}
                aria-label="Descripción de la imagen"
              />
              {mentionMenuOpen && photos.length > 0 && (
                <div className="absolute top-full left-0 w-full z-50 bg-white dark:bg-[#3a3525] shadow-2xl border border-gray-100 dark:border-gray-700 rounded-xl mt-2 overflow-hidden animate-in fade-in slide-in-from-top-2">
                  <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 text-[10px] uppercase font-bold text-gray-400 tracking-widest border-b dark:border-gray-700">Mencionar Imagen</div>
                  <div className="max-h-60 overflow-y-auto">
                    {photos.map((photo, i) => (
                      <button 
                        key={photo.id}
                        onClick={() => insertMention(`@img${i+1}`)}
                        className="w-full text-left px-3 py-2.5 hover:bg-primary/10 text-sm font-medium transition-colors border-b border-gray-50 dark:border-gray-700 last:border-none flex items-center gap-3 group"
                      >
                        <div className="w-10 h-10 rounded-lg overflow-hidden border border-gray-100 dark:border-gray-600 group-hover:border-primary/50 transition-colors">
                          <img src={photo.url} alt={`Referencia ${i+1}`} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex flex-col">
                          <span className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded font-bold self-start mb-0.5 group-hover:bg-primary group-hover:text-white transition-colors">@IMG{i+1}</span>
                          <span className="text-gray-500 text-[11px]">Imagen de referencia {i+1}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-6 bg-white dark:bg-[#2d291e] p-6 rounded-xl shadow-sm border border-[#f3f0e7] dark:border-[#3a3525]">
            <div className="flex items-start gap-3">
              <span className="step-number" aria-hidden="true">3</span>
              <h3 className="text-lg font-bold leading-tight">Correo electrónico</h3>
            </div>
            <p className="text-xs text-[#9b874b]">Aquí enviaremos tu PDF automáticamente. (También podrás descargarlo al finalizar la generación)</p>
            <div className="flex-1 flex flex-col justify-center">
              <label htmlFor="email-input" className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-gray-500">Tu email</label>
              <input 
                id="email-input"
                className="w-full px-4 py-3 bg-background-light dark:bg-background-dark border-none rounded-lg text-sm focus:ring-2 focus:ring-primary"
                placeholder="ejemplo@correo.com"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setValidationError(null);
                }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-6 bg-white dark:bg-[#2d291e] p-6 rounded-xl shadow-sm border-2 border-primary/30 relative">
            <div className="flex items-start gap-3">
              <span className="step-number" aria-hidden="true">4</span>
              <h3 className="text-lg font-bold leading-tight text-primary">Pagar y Generar</h3>
            </div>
            <div className="bg-primary/10 dark:bg-primary/5 p-4 rounded-lg flex justify-between items-center" aria-label="Precio del paquete">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-primary">Paquete Pintatina</p>
                <p className="text-xl font-black">10 Dibujos</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black">$2</p>
                <p className="text-[10px] text-gray-500">USD</p>
              </div>
            </div>
            
            <div className="relative">
              {validationError && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-[280px] p-4 bg-red-600 text-white text-[11px] font-bold rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-3 z-[60] text-center border-2 border-white/20 backdrop-blur-sm">
                  <div className="relative">
                    <svg className="size-3.5 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <span className="font-bold">ATENCIÓN</span>
                    {validationError}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-4 h-4 bg-red-600 rotate-45 -mt-2 border-r border-b border-white/10"></div>
                  </div>
                </div>
              )}
              <button 
                onClick={handlePayAndGenerate}
                className="w-full bg-primary hover:bg-primary/90 text-black font-black py-4 rounded-full text-md shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 group active:scale-95"
                aria-label="Pagar y comenzar generación de imágenes"
              >
                <span>Pagar y Generar</span>
              </button>
            </div>

            <div className="flex justify-center items-center mt-auto py-2">
              <img 
                alt="PayPal Pago Seguro" 
                className="h-8 object-contain opacity-80 hover:opacity-100 transition-opacity" 
                src="https://lasucursaldigital.com/wp-content/uploads/2026/01/logo-paypal.webp"
              />
            </div>
          </div>
        </div>

        <section id="results-section" className="flex flex-col gap-8 scroll-mt-24 relative" aria-labelledby="results-title">
          {showSuccessToast && (
             <div className="flex items-center justify-center gap-3 bg-green-500 text-white py-4 px-8 rounded-2xl shadow-xl animate-in fade-in slide-in-from-top-4 duration-500 mb-2 border-2 border-white/20">
                <svg className="size-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <span className="font-black text-lg uppercase tracking-tight">¡Tus dibujos están listos!</span>
             </div>
          )}
          
          <div className="flex flex-col gap-6 bg-white dark:bg-[#2d291e] p-6 rounded-2xl border border-[#f3f0e7] dark:border-[#3a3525] shadow-sm overflow-hidden relative">
            {isGenerating && (
              <div className="absolute top-0 left-0 w-full h-1 bg-gray-100 overflow-hidden" role="progressbar" aria-valuenow={progressPercentage} aria-valuemin={0} aria-valuemax={100}>
                <div 
                  className="h-full bg-gradient-to-r from-primary/60 via-primary to-primary/60 transition-all duration-500 ease-out"
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
            )}
            
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="flex flex-col gap-2">
                <h2 id="results-title" className="text-2xl font-bold flex items-center gap-3">
                  Tus Imágenes Generadas
                  {isGenerating && (
                    <span className="text-sm font-normal text-primary bg-primary/10 px-3 py-1 rounded-full animate-pulse">
                      Colección en marcha ({completedCount}/10)
                    </span>
                  )}
                </h2>
                <div className="flex flex-col gap-1">
                  <p className="text-sm text-[#9b874b] italic">Se generarán 10 imágenes diferentes para colorear</p>
                  {emailSentSuccessfully && (
                    <p className="text-xs text-green-600 font-bold flex items-center gap-1">
                      <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      PDF enviado automáticamente a {email}
                    </p>
                  )}
                  {hasErrors && !isGenerating && (
                    <p className="text-xs text-red-500 font-bold flex items-center gap-1">
                      <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                      Hubo un problema con algunas imágenes. Reintenta sin costo.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                {hasErrors && !isGenerating && (
                  <button 
                    onClick={handleRetry}
                    className="flex items-center gap-2 px-6 py-3 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-full text-sm font-bold transition-all shadow-sm"
                  >
                    <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                    Reintentar fallidos
                  </button>
                )}
                <button 
                  onClick={() => handleSendEmail()}
                  disabled={isGenerating || isSendingEmail || generatedImages.every(img => img.status === 'pending')}
                  className={`flex items-center gap-2.5 px-6 py-3 border border-[#f3f0e7] rounded-full text-sm font-bold transition-all shadow-sm ${
                    isGenerating || isSendingEmail || generatedImages.every(img => img.status === 'pending')
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                    : 'bg-white hover:bg-gray-50 text-black'
                  }`}
                  aria-label="Enviar imágenes por correo electrónico"
                >
                  <span className={`flex items-center justify-center text-primary ${isSendingEmail ? 'animate-spin' : ''}`}>
                    {isSendingEmail ? (
                      <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                    ) : (emailSentSuccessfully ? (
                      <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    ) : (
                      <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                    ))}
                  </span>
                  {isSendingEmail ? 'Enviando...' : (emailSentSuccessfully ? '¡Enviado!' : 'Enviar por correo')}
                </button>
                <button 
                  onClick={handleDownloadPDF}
                  disabled={isGenerating || isExporting || generatedImages.every(img => img.status === 'pending')}
                  className={`relative flex flex-col items-center px-8 py-3 rounded-full text-sm font-bold transition-all shadow-md min-w-[180px] overflow-hidden ${
                    isGenerating || isExporting || generatedImages.every(img => img.status === 'pending')
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-primary text-black hover:bg-primary/90'
                  }`}
                  aria-label="Descargar cuaderno de colorear en PDF"
                >
                  {isExporting && (
                    <div className="absolute inset-0 bg-primary/20 animate-[loading-bar_2s_linear_infinite]"></div>
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    {isExporting && <svg className="size-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>}
                    {isExporting ? 'Preparando PDF...' : 'Descargar PDF'}
                  </span>
                  {!isExporting && <span className="text-[10px] font-normal italic relative z-10">Optimizado para imprimir</span>}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            {generatedImages.map((img, idx) => (
              <div key={img.id} className="group relative aspect-[3/4] rounded-xl overflow-hidden bg-white dark:bg-[#2d291e] border border-[#f3f0e7] dark:border-[#3a3525] shadow-sm transition-all duration-500 hover:shadow-2xl hover:scale-[1.03] hover:-translate-y-1 cursor-default" aria-label={`Imagen ${idx + 1}`}>
                {img.status === 'pending' ? (
                   <div className="absolute inset-0 dotted-border m-2.5 flex flex-col items-center justify-center text-gray-300 dark:text-[#4a4535]">
                    <svg className="size-10 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">Imagen {idx + 1}</span>
                  </div>
                ) : img.status === 'loading' ? (
                  <LoadingCard index={idx} />
                ) : img.status === 'completed' ? (
                  <div className="relative w-full h-full animate-in fade-in zoom-in duration-700 overflow-hidden">
                    <img src={img.url} alt={`Resultado de imagen para colorear número ${idx + 1}`} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" />
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[8px] font-bold text-gray-400 bg-white/70 px-2 py-0.5 rounded shadow-sm backdrop-blur-[2px]">
                      Pintatina.com
                    </div>
                    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-red-50/30">
                    <svg className="size-8 text-red-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <span className="text-[10px] font-bold text-red-500 uppercase">Fallo en la creación</span>
                    <p className="text-[9px] text-red-400 mt-1 leading-tight">Pulsa 'Reintentar fallidos' para completar tu colección.</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="bg-white dark:bg-[#1a170d] border-t border-[#f3f0e7] dark:border-[#3a3525] py-12 mt-20" role="contentinfo">
        <div className="max-w-[1200px] mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12 text-sm">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="size-6 text-primary" aria-hidden="true">
                <svg fill="currentColor" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path d="M44 11.2727C44 14.0109 39.8386 16.3957 33.69 17.6364C39.8386 18.877 44 21.2618 44 24C44 26.7382 39.8386 29.123 33.69 30.3636C39.8386 31.6043 44 33.9891 44 36.7273C44 40.7439 35.0457 44 24 44C12.9543 44 4 40.7439 4 36.7273C4 33.9891 8.16144 31.6043 14.31 30.3636C8.16144 29.123 4 26.7382 4 24C4 21.2618 8.16144 18.877 14.31 17.6364C8.16144 16.3957 4 14.0109 4 11.2727C4 7.25611 12.9543 4 24 4C35.0457 4 44 7.25611 44 11.2727Z"></path></svg>
              </div>
              <span className="font-bold text-lg">Pintatina</span>
            </div>
            <p className="text-gray-500 max-w-sm mb-6">Privado y seguro. Generador de dibujos para colorear mediante inteligencia artificial. No guardamos tus fotos de forma permanente.</p>
            
            <div className="flex items-center gap-4">
              <a href="#" className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-50 dark:bg-[#2d291e] text-gray-400 hover:text-primary hover:bg-primary/10 transition-all border border-transparent hover:border-primary/20" aria-label="Facebook">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M9 8H6v4h3v12h5V12h3.642L18 8h-4V6.333C14 5.378 14.192 5 15.115 5H18V0h-3.808C10.596 0 9 1.583 9 4.615V8z"/></svg>
              </a>
              <a href="#" className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-50 dark:bg-[#2d291e] text-gray-400 hover:text-primary hover:bg-primary/10 transition-all border border-transparent hover:border-primary/20" aria-label="Instagram">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
              </a>
              <a href="#" className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-50 dark:bg-[#2d291e] text-gray-400 hover:text-primary hover:bg-primary/10 transition-all border border-transparent hover:border-primary/20" aria-label="TikTok">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.9-.32-1.98-.23-2.81.33-.85.51-1.44 1.43-1.58 2.41-.14 1.02.23 2.1.94 2.87.56.62 1.34 1.03 2.16 1.14.82.11 1.67-.09 2.37-.53.84-.52 1.41-1.44 1.52-2.43.15-1.42.04-2.84.06-4.26V.02z"/></svg>
              </a>
            </div>
          </div>
          <nav aria-label="Enlaces de información">
            <h4 className="font-bold mb-4">Información</h4>
            <ul className="space-y-2 text-gray-500">
              <li><button onClick={() => setIsFAQModalOpen(true)} className="hover:text-primary transition-colors text-left">Preguntas Frecuentes</button></li>
              <li><button onClick={() => setIsContactModalOpen(true)} className="hover:text-primary transition-colors text-left">Contacto</button></li>
            </ul>
          </nav>
          <nav aria-label="Enlaces legales">
            <h4 className="font-bold mb-4">Legal</h4>
            <ul className="space-y-2 text-gray-500">
              <li><button onClick={() => setIsPrivacyModalOpen(true)} className="hover:text-primary transition-colors text-left">Privacidad</button></li>
              <li><button onClick={() => setIsTermsModalOpen(true)} className="hover:text-primary transition-colors text-left">Términos de Servicio</button></li>
            </ul>
          </nav>
        </div>
      </footer>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative z-10 w-full max-w-[520px] bg-white dark:bg-[#2d1e14] rounded-lg shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              aria-label="Cerrar modal"
            >
              <svg className="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <div className="px-8 pt-8 pb-4">
              <h2 id="modal-title" className="text-[#1c130d] dark:text-white text-2xl font-bold leading-tight tracking-[-0.015em]">
                Finaliza tu pedido <span className="text-gray-400 font-normal">/ Complete your order</span>
              </h2>
              <p className="text-sm text-gray-500 mt-1 italic">Pintatina - Transacción segura</p>
            </div>
            <div className="px-8 py-4">
              <div className="bg-background-light dark:bg-background-dark/50 rounded-xl p-5 border border-gray-100">
                <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-2">Detalle del pedido</p>
                <div className="flex justify-between items-center py-2">
                  <p className="text-lg font-medium flex items-center gap-2">
                    <svg className="size-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"></path></svg>
                    10 imágenes para colorear
                  </p>
                  <p className="text-xl font-bold">$2.00</p>
                </div>
                <div className="mt-2 pt-2 border-t border-dashed border-gray-300 flex justify-between items-center text-xs text-gray-400">
                  <span>Impuestos incluidos</span>
                  <span>Total USD</span>
                </div>
              </div>
            </div>

            <div className="px-8 py-4 space-y-4">
              <label className="flex flex-col">
                <span className="text-sm font-medium pb-2">Número de tarjeta</span>
                <div className="relative">
                  <input className="w-full h-14 rounded-full border border-gray-200 dark:border-gray-700 dark:bg-[#1c180d] px-5 pr-12 focus:ring-primary" placeholder="0000 0000 0000 0000" />
                  <svg className="size-5 absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                </div>
              </label>
              <div className="flex gap-4">
                <label className="flex-1">
                  <span className="text-sm font-medium block pb-2">Expiración</span>
                  <input className="w-full h-14 rounded-full border border-gray-200 dark:border-gray-700 dark:bg-[#1c180d] px-5" placeholder="MM / YY" />
                </label>
                <label className="flex-1">
                  <span className="text-sm font-medium block pb-2">CVC</span>
                  <input className="w-full h-14 rounded-full border border-gray-200 dark:border-gray-700 dark:bg-[#1c180d] px-5" placeholder="123" />
                </label>
              </div>
            </div>

            <div className="px-8 py-8 flex flex-col gap-4">
              <button 
                onClick={startGeneration}
                className="w-full bg-primary hover:bg-primary/90 text-white h-14 rounded-full font-bold text-lg shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
              >
                Pagar ahora <span className="font-normal opacity-80">/ Pay Now</span>
              </button>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="w-full text-gray-500 text-sm font-medium hover:text-gray-800 transition-colors"
              >
                Cancelar <span className="opacity-50">/ Cancel</span>
              </button>
            </div>
            <div className="h-2 w-full bg-gradient-to-r from-primary/20 via-primary/60 to-primary/20"></div>
          </div>
        </div>
      )}

      {isFAQModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="faq-title">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsFAQModalOpen(false)}></div>
          <div className="relative z-10 w-full max-w-[600px] bg-white dark:bg-[#2d1e14] rounded-lg shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300 max-h-[90vh]">
            <button 
              onClick={() => setIsFAQModalOpen(false)}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 z-20"
              aria-label="Cerrar preguntas frecuentes"
            >
              <svg className="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            
            <div className="px-8 pt-10 pb-6 border-b dark:border-gray-800 relative">
              <h2 id="faq-title" className="text-[#1c130d] dark:text-white text-3xl font-black leading-tight tracking-tight">
                Preguntas <span className="text-primary">Frecuentes</span>
              </h2>
              <p className="text-gray-500 mt-2">Todo lo que necesitas saber sobre Pintatina.</p>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8 custom-scrollbar">
              {FAQ_DATA.map((item, index) => (
                <div key={index} className="flex flex-col gap-3 group">
                  <div className="flex items-start gap-4">
                    <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-black text-sm shrink-0 mt-0.5 group-hover:bg-primary group-hover:text-white transition-colors">
                      {index + 1}
                    </span>
                    <div className="flex flex-col gap-2">
                      <h3 className="text-lg font-bold leading-tight text-[#1c130d] dark:text-white">{item.question}</h3>
                      <p className="text-sm text-gray-500 leading-relaxed">{item.answer}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-8 py-6 bg-gray-50 dark:bg-black/20 border-t dark:border-gray-800 flex items-center justify-end">
              <button 
                onClick={() => setIsFAQModalOpen(false)}
                className="bg-primary/10 hover:bg-primary/20 text-primary px-6 py-2 rounded-full font-bold text-sm transition-all"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {isPrivacyModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="privacy-title">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsPrivacyModalOpen(false)}></div>
          <div className="relative z-10 w-full max-w-[650px] bg-white dark:bg-[#1a130d] rounded-lg shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300 max-h-[90vh]">
            <button 
              onClick={() => setIsPrivacyModalOpen(false)}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 z-20"
              aria-label="Cerrar política de privacidad"
            >
              <svg className="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            
            <div className="px-8 pt-10 pb-6 border-b dark:border-gray-800 relative">
              <h2 id="privacy-title" className="text-[#1c130d] dark:text-white text-3xl font-black leading-tight tracking-tight">
                Política de <span className="text-primary">Privacidad</span>
              </h2>
              <p className="text-gray-500 mt-2">Tu seguridad y confianza son lo primero.</p>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 custom-scrollbar">
              <div className="space-y-4">
                <div className="bg-primary/5 p-5 rounded-xl border border-primary/10">
                   <h3 className="text-primary font-black text-xs uppercase tracking-widest mb-2">Resumen de Compromiso</h3>
                   <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                     En <strong>Pintatina</strong>, operamos bajo un principio de privacidad absoluta. No recolectamos datos innecesarios ni perfilamos a nuestros usuarios.
                   </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/10">
                    <svg className="size-5 text-primary mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                    <h4 className="font-bold text-sm mb-1">Fotos no almacenadas</h4>
                    <p className="text-xs text-gray-500">Las imágenes que subes se procesan en tiempo real y <strong>no se guardan</strong> en nuestros servidores permanentemente.</p>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/10">
                    <svg className="size-5 text-primary mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                    <h4 className="font-bold text-sm mb-1">Generaciones efímeras</h4>
                    <p className="text-xs text-gray-500">Los dibujos generados son para tu uso exclusivo. No mantenemos una galería de tus creaciones tras la sesión.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-bold text-[#1c130d] dark:text-white">Tratamiento de Datos</h4>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5 shrink-0"></span>
                      <p className="text-sm text-gray-500"><strong className="text-gray-700 dark:text-gray-300">Correo Electrónico:</strong> Es el único dato que conservamos. Lo utilizamos estrictamente para enviarte tu PDF, gestionar posibles reclamos o comunicarte información vital sobre el servicio.</p>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5 shrink-0"></span>
                      <p className="text-sm text-gray-500"><strong className="text-gray-700 dark:text-gray-300">Pagos Seguros:</strong> Los datos de tu tarjeta y medios de pago son administrados directamente por nuestra <strong>pasarela de pagos</strong> certificada (Stripe/PayPal). Pintatina nunca tiene acceso ni almacena tu información financiera.</p>
                    </li>
                  </ul>
                </div>

                <p className="text-xs text-gray-400 italic pt-4">
                  Al utilizar Pintatina, aceptas este tratamiento responsable de tus datos, diseñado para ofrecerte la mejor experiencia creativa con la máxima seguridad.
                </p>
              </div>
            </div>

            <div className="px-8 py-6 bg-gray-50 dark:bg-black/20 border-t dark:border-gray-800 flex items-center justify-end">
              <button 
                onClick={() => setIsPrivacyModalOpen(false)}
                className="bg-primary text-black px-8 py-2.5 rounded-full font-black text-sm transition-all shadow-lg shadow-primary/20 hover:scale-105 active:scale-95"
              >
                Cerrar y Volver
              </button>
            </div>
          </div>
        </div>
      )}

      {isTermsModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="terms-title">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsTermsModalOpen(false)}></div>
          <div className="relative z-10 w-full max-w-[650px] bg-white dark:bg-[#1a130d] rounded-lg shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300 max-h-[90vh]">
            <button 
              onClick={() => setIsTermsModalOpen(false)}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 z-20"
              aria-label="Cerrar términos de servicio"
            >
              <svg className="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            
            <div className="px-8 pt-10 pb-6 border-b dark:border-gray-800 relative">
              <h2 id="terms-title" className="text-[#1c130d] dark:text-white text-3xl font-black leading-tight tracking-tight">
                Términos de <span className="text-primary">Servicio</span>
              </h2>
              <p className="text-gray-500 mt-2">Condiciones legales para el uso de nuestra plataforma.</p>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 custom-scrollbar">
              <div className="space-y-5">
                <section>
                  <h3 className="font-bold text-[#1c130d] dark:text-white mb-2">1. Aceptación del Servicio</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    Al acceder y utilizar Pintatina, aceptas estar sujeto a estos términos. Nuestra plataforma ofrece una herramienta de generación de imágenes asistida por IA para fines recreativos y personales.
                  </p>
                </section>

                <section>
                  <h3 className="font-bold text-[#1c130d] dark:text-white mb-2">2. Licencia de Uso</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    Conservas la propiedad de las fotos originales que subas. Pintatina te otorga una licencia de uso personal, no exclusiva y permanente para imprimir, compartir y disfrutar de los dibujos generados. Queda prohibida la reventa del servicio o el uso comercial a gran escala de la tecnología sin autorización.
                  </p>
                </section>

                <section>
                  <h3 className="font-bold text-[#1c130d] dark:text-white mb-2">3. Política de Productos Digitales</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    Pintatina ofrece un producto digital generado al instante. Debido a la naturaleza del servicio y al consumo de recursos de computación en tiempo real, <strong>no se ofrecen reembolsos</strong> una vez iniciada la generación, excepto en casos donde un fallo técnico comprobado impida la entrega total del material.
                  </p>
                </section>

                <section>
                  <h3 className="font-bold text-[#1c130d] dark:text-white mb-2">4. Uso Responsable de la IA</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    La inteligencia artificial puede producir resultados variados. El servicio se ofrece "tal cual" y Pintatina no garantiza que cada imagen sea una representación exacta o perfecta de la realidad. No se permite subir contenido ofensivo, ilegal o que infrinja derechos de autor de terceros.
                  </p>
                </section>

                <section>
                  <h3 className="font-bold text-[#1c130d] dark:text-white mb-2">5. Requisitos de Edad</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    Aunque el producto final es para niños, el uso de la plataforma y la realización de pagos debe ser efectuado por un adulto legalmente capaz.
                  </p>
                </section>
              </div>
            </div>

            <div className="px-8 py-6 bg-gray-50 dark:bg-black/20 border-t dark:border-gray-800 flex items-center justify-end">
              <button 
                onClick={() => setIsTermsModalOpen(false)}
                className="bg-primary text-black px-8 py-2.5 rounded-full font-black text-sm transition-all shadow-lg shadow-primary/20 hover:scale-105 active:scale-95"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {isContactModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="contact-title">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsContactModalOpen(false)}></div>
          <div className="relative z-10 w-full max-w-[500px] bg-white dark:bg-[#1a130d] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300">
            <button 
              onClick={() => setIsContactModalOpen(false)}
              className="absolute top-8 right-10 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 z-20 text-sm font-bold uppercase tracking-widest"
              aria-label="Cerrar contacto"
            >
              close
            </button>
            
            <div className="px-10 pt-12 pb-6 relative">
              <h2 id="contact-title" className="text-[#1c130d] dark:text-white text-4xl font-black leading-tight tracking-tight text-center">
                ¿Necesitas <span className="text-primary">Ayuda?</span>
              </h2>
              <p className="text-gray-400 mt-2 text-center text-sm font-medium">Estamos aquí para escucharte y ayudarte.</p>
            </div>

            <div className="px-10 py-6 space-y-8">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="relative size-24 flex items-center justify-center mb-2">
                   <div className="absolute inset-0 bg-primary/5 rounded-full scale-125 blur-xl"></div>
                   <div className="absolute inset-0 bg-primary/10 rounded-full"></div>
                   <svg className="w-12 h-12 text-primary relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                   </svg>
                </div>
                <div className="space-y-1">
                   <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Correo de Soporte</p>
                   <a href="mailto:pintatina@gmail.com" className="text-2xl font-black text-[#1c130d] dark:text-white hover:text-primary transition-colors">
                     pintatina@gmail.com
                   </a>
                </div>
              </div>

              <div className="bg-[#fff9f4] dark:bg-primary/5 p-8 rounded-3xl border border-primary/10">
                <div className="flex gap-4">
                  <span className="text-primary font-black text-sm uppercase shrink-0 mt-0.5">info</span>
                  <p className="text-sm leading-relaxed text-[#5c4033] dark:text-gray-300">
                    Si tienes alguna sugerencia o necesitas asistencia técnica, escríbenos. <strong className="text-primary">IMPORTANTE:</strong> Por favor usa el mismo correo con el que realizaste tu compra para que podamos ayudarte mucho más rápido.
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-center gap-6 pt-4">
                <div className="flex flex-col items-center gap-1 text-center">
                  <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">Siguenos en redes sociales</p>
                  <p className="text-[11px] font-medium text-gray-500 italic">(Comparte con nosotros los dibujos pintados por tus hijos)</p>
                </div>
                <div className="flex items-center gap-10">
                  <a href="#" className="group flex flex-col items-center gap-2 transition-all hover:-translate-y-1" aria-label="Facebook">
                    <div className="size-14 rounded-full bg-gray-50 dark:bg-white/5 flex items-center justify-center text-gray-300 group-hover:bg-[#1877F2] group-hover:text-white transition-all shadow-sm">
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M9 8H6v4h3v12h5V12h3.642L18 8h-4V6.333C14 5.378 14.192 5 15.115 5H18V0h-3.808C10.596 0 9 1.583 9 4.615V8z"/></svg>
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 group-hover:text-[#1877F2]">Facebook</span>
                  </a>
                  <a href="#" className="group flex flex-col items-center gap-2 transition-all hover:-translate-y-1" aria-label="Instagram">
                    <div className="size-14 rounded-full bg-gray-50 dark:bg-white/5 flex items-center justify-center text-gray-300 group-hover:bg-gradient-to-tr group-hover:from-[#FCAF45] group-hover:via-[#E1306C] group-hover:to-[#C13584] group-hover:text-white transition-all shadow-sm">
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 group-hover:text-[#E1306C]">Instagram</span>
                  </a>
                  <a href="#" className="group flex flex-col items-center gap-2 transition-all hover:-translate-y-1" aria-label="TikTok">
                    <div className="size-14 rounded-full bg-gray-50 dark:bg-white/5 flex items-center justify-center text-gray-300 group-hover:bg-black group-hover:text-white transition-all shadow-sm">
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.9-.32-1.98-.23-2.81.33-.85.51-1.44 1.43-1.58 2.41-.14 1.02.23 2.1.94 2.87.56.62 1.34 1.03 2.16 1.14.82.11 1.67-.09 2.37-.53.84-.52 1.41-1.44 1.52-2.43.15-1.42.04-2.84.06-4.26V.02z"/></svg>
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 group-hover:text-black dark:group-hover:text-white">TikTok</span>
                  </a>
                </div>
              </div>
            </div>

            <div className="px-10 py-10 flex items-center justify-center">
              <button 
                onClick={() => setIsContactModalOpen(false)}
                className="bg-primary text-black px-16 py-4 rounded-full font-black text-lg transition-all shadow-xl shadow-primary/20 hover:scale-105 active:scale-95"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes scanner {
          0% { top: 0; }
          50% { top: 100%; }
          100% { top: 0; }
        }
        @keyframes wiggle {
          0%, 100% { transform: rotate(-5deg) translateY(0); }
          50% { transform: rotate(5deg) translateY(-5px); }
        }
        @keyframes loading-bar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #ff812544;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #ff812588;
        }
      `}</style>
    </div>
  );
}

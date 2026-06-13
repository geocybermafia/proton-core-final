import * as fs from 'fs';
import * as path from 'path';

const hubPath = path.join(process.cwd(), 'src', 'components', 'MarketHub.tsx');
let content = fs.readFileSync(hubPath, 'utf8');

const startAnchor = `      ) : (
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className={cn("max-w-2xl mx-auto p-5 sm:p-10 rounded-[24px] sm:rounded-[40px] border", currentTheme.card, currentTheme.border)}
        >`;

const endAnchor = `           </form>
        </motion.div>
      )}`;

// We design a stunning, high-performance, futuristic glassmorphic layout
const replacementForm = `      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            "max-w-2xl mx-auto p-6 sm:p-12 rounded-[32px] sm:rounded-[48px] border backdrop-blur-2xl relative overflow-hidden shadow-[0_24px_50px_-12px_rgba(0,0,0,0.7)]", 
            "bg-zinc-950/75 border-zinc-800/80 hover:border-[#dfb257]/30 transition-colors duration-500"
          )}
        >
           {/* Futuristic Background Gradients */}
           <div className="absolute top-0 left-0 w-64 h-64 bg-[#dfb257]/5 rounded-full blur-[120px] pointer-events-none" />
           <div className="absolute bottom-0 right-0 w-64 h-64 bg-zinc-800/20 rounded-full blur-[100px] pointer-events-none" />

           <form onSubmit={handleSubmitListing} className="space-y-10 relative z-10">
              {/* Dynamic Interactive Steps Header */}
              <div className="flex flex-col gap-6 mb-8 pb-8 border-b border-zinc-900/80">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3.5">
                       <div className="p-3 rounded-2xl bg-[#dfb257]/10 text-[#dfb257] border border-[#dfb257]/20 shadow-[0_0_15px_rgba(223,178,87,0.1)] select-none">
                          <Plus size={20} className="stroke-[2.5]" />
                       </div>
                       <div>
                          <h2 className="text-base font-black uppercase tracking-wider text-white font-sans">
                             {viewMode === 'create' ? (language === 'ka' ? 'განცხადების შექმნა' : 'Create Listing') : (language === 'ka' ? 'რედაქტირება' : 'Edit Listing')}
                          </h2>
                          <div className="flex items-center gap-2 mt-1">
                             <span className="w-1.5 h-1.5 rounded-full bg-[#dfb257] animate-pulse" />
                             <p className="text-[10px] font-black text-[#dfb257] uppercase tracking-widest">
                                {language === 'ka' ? \`ნაბიჯი \${formStep} 3-დან\` : \`Step \${formStep} of 3\`}
                             </p>
                          </div>
                       </div>
                    </div>
                    
                    {/* Compact step progress radial tracker */}
                    <div className="text-[10px] font-mono font-black text-zinc-500 bg-zinc-950 px-3 py-1.5 rounded-full border border-zinc-900 select-none">
                       PROGRESS: {formStep === 1 ? '33%' : formStep === 2 ? '66%' : '100%'}
                    </div>
                 </div>

                 {/* Stunning Interconnecting Modern Custom Stepper Slider */}
                 <div className="relative pt-2">
                    {/* Background Progress Railway Line */}
                    <div className="absolute top-6 left-0 right-0 h-[2px] bg-zinc-900/80 rounded-full">
                       <div 
                          className="h-full bg-gradient-to-r from-[#dfb257] to-[#e4be6b] transition-all duration-500 rounded-full"
                          style={{ width: formStep === 1 ? '16.66%' : formStep === 2 ? '50%' : '83.33%' }}
                       />
                    </div>
                    
                    <div className="flex items-center justify-between relative">
                       {[1, 2, 3].map((step) => {
                          const stepTitles = [
                             language === 'ka' ? 'კატეგორია' : 'Classification',
                             language === 'ka' ? 'ფასი & პირობები' : 'Price & Terms',
                             language === 'ka' ? 'ლოკაცია & მედია' : 'Media & Map'
                          ];
                          const isCompleted = formStep > step;
                          const isActive = formStep === step;

                          return (
                             <button
                                key={step}
                                type="button"
                                onClick={() => {
                                   if (step > 1 && !formData.title.trim()) {
                                      alert(language === 'ka' ? "გთხოვთ პირველ ნაბიჯზე შეიყვანოთ სათაური გასაგრძელებლად" : "Please input a listing title on Step 1 first.");
                                      return;
                                   }
                                   setFormStep(step);
                                }}
                                className="group flex flex-col items-center focus:outline-none transition-all duration-300"
                             >
                                <div className={cn(
                                   "w-10 h-10 rounded-full border flex items-center justify-center text-xs font-black transition-all duration-500 z-10",
                                   isActive
                                      ? "bg-[#dfb257] border-[#dfb257] text-[#070708] shadow-[0_0_20px_rgba(223,178,87,0.4)] scale-110"
                                      : isCompleted
                                      ? "bg-zinc-950 border-[#dfb257]/60 text-[#dfb257] hover:border-[#dfb257]"
                                      : "bg-zinc-950 border-zinc-900 text-zinc-500 hover:text-zinc-300 hover:border-zinc-800"
                                )}>
                                   {isCompleted ? (
                                      <ShieldCheck size={16} className="stroke-[2.5]" />
                                   ) : (
                                      <span className="font-mono">{step}</span>
                                   )}
                                </div>
                                <span className={cn(
                                   "text-[9px] font-black uppercase tracking-widest mt-2.5 transition-all duration-500",
                                   isActive ? "text-[#dfb257]" : "text-zinc-550 group-hover:text-zinc-400"
                                )}>
                                   {stepTitles[step - 1]}
                                </span>
                             </button>
                          );
                       })}
                    </div>
                 </div>
              </div>

              {/* STEP 1: Core Classification & Info */}
              {formStep === 1 && (
                 <motion.div 
                    initial={{ opacity: 0, y: 15 }} 
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.35 }}
                    className="space-y-8 animate-in fade-in"
                 >
                    {/* Listing Type Premium Cards Selection */}
                    <div className="space-y-4">
                       <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black uppercase tracking-widest text-[#dfb257] flex items-center gap-1.5">
                             <span>⚡</span> {language === 'ka' ? 'განცხადების კლასიფიკაცია' : 'Classification Class'}
                          </label>
                          <span className="text-[8px] font-mono text-zinc-600 block uppercase">Select node archetype</span>
                       </div>
                       
                       <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          {[
                             { 
                                type: 'service', 
                                emoji: '⚡', 
                                labelEn: 'Service', 
                                labelKa: 'სერვისი',
                                descEn: 'Professional expertise & tasks',
                                descKa: 'ტექნიკური ან სხვა მომსახურება'
                             },
                             { 
                                type: 'product', 
                                emoji: '📦', 
                                labelEn: 'Product', 
                                labelKa: 'პროდუქტი',
                                descEn: 'Componentry & inventory items',
                                descKa: 'დანადგარები, ნაწილები და ქონება'
                             },
                             { 
                                type: 'project', 
                                emoji: '🚀', 
                                labelEn: 'Project', 
                                labelKa: 'პროექტი',
                                descEn: 'Complex ventures & systems',
                                descKa: 'კომპლექსური საინჟინრო ინიციატივები'
                             }
                          ].map(item => {
                             const isSelected = formData.listingType === item.type;
                             return (
                                <button
                                   key={item.type}
                                   type="button"
                                   onClick={() => {
                                      setFormData(prev => ({ 
                                         ...prev, 
                                         listingType: item.type as any,
                                         category: item.type === 'service' 
                                            ? 'service' 
                                            : item.type === 'project' 
                                            ? 'project' 
                                            : 'technics'
                                      }));
                                   }}
                                   className={cn(
                                      "relative p-4 rounded-2xl border transition-all duration-300 flex flex-col items-center text-center gap-2 hover:scale-[1.03] group overflow-hidden",
                                      isSelected
                                         ? "bg-[#dfb257]/10 border-[#dfb257] text-[#dfb257] shadow-[0_8px_20px_-6px_rgba(223,178,87,0.15)] ring-1 ring-[#dfb257]/30"
                                         : "bg-zinc-950/70 border-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-900/40 hover:border-zinc-800"
                                   )}
                                >
                                   {/* Mini neon glowing point */}
                                   {isSelected && (
                                      <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-[#dfb257] shadow-[0_0_8px_#dfb257]" />
                                   )}
                                   <span className="text-2xl mb-1 filter drop-shadow-[0_4px_6px_rgba(0,0,0,0.5)] group-hover:scale-110 transition-transform duration-300">
                                      {item.emoji}
                                   </span>
                                   <span className="text-xs font-black uppercase tracking-wider">
                                      {language === 'ka' ? item.labelKa : item.labelEn}
                                   </span>
                                   <span className="text-[8px] font-semibold text-zinc-550 leading-relaxed max-w-[150px] uppercase tracking-wide">
                                      {language === 'ka' ? item.descKa : item.descEn}
                                   </span>
                                </button>
                             );
                          })}
                       </div>
                    </div>

                    {/* Listing Category Selection */}
                    <div className="space-y-3">
                       <label className="text-[10px] font-black uppercase tracking-widest text-[#dfb257] flex items-center gap-1.5">
                          <span>📁</span> {t.market.form.category}
                       </label>
                       <div className="relative group">
                          <select 
                             value={formData.category}
                             onChange={e => setFormData({...formData, category: e.target.value})}
                             className={cn(
                                "w-full pl-4 pr-10 py-3.5 rounded-2xl border appearance-none text-xs font-bold text-white tracking-wide shadow-inner transition-all",
                                "bg-[#09090b]/90 border-zinc-850/80 focus:outline-none focus:border-[#dfb257] focus:ring-4 focus:ring-[#dfb257]/10",
                                currentTheme.input
                             )}
                          >
                             {Object.entries(t.market.categories).map(([key, label]) => (
                                <option key={key} value={key} className="bg-zinc-950 text-white font-semibold py-2">
                                   {label as string}
                                </option>
                             ))}
                          </select>
                          <ChevronDown size={14} className="absolute right-4.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none group-hover:text-zinc-300 transition-colors" />
                       </div>
                    </div>

                    {/* Title in EN & GE */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                       <div className="space-y-3">
                          <div className="flex items-center justify-between">
                             <div className="flex items-center gap-2">
                                <span className="text-xs">🇬🇧</span>
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{t.market.form.title} (EN)</label>
                             </div>
                             <span className="text-[8px] font-mono text-zinc-650">Required</span>
                          </div>
                          <div className="relative">
                             <input 
                                required
                                type="text"
                                value={formData.title}
                                onChange={e => setFormData({...formData, title: e.target.value})}
                                placeholder="e.g. Industrial Control Unit v3"
                                className={cn(
                                   "w-full px-4.5 py-3.5 rounded-2xl border text-xs font-bold text-white shadow-inner transition-all",
                                   "bg-[#09090b]/90 border-zinc-850/80 focus:outline-none focus:border-[#dfb257] focus:ring-4 focus:ring-[#dfb257]/10 placeholder-zinc-550",
                                   currentTheme.input
                                )}
                             />
                          </div>
                       </div>

                       <div className="space-y-3">
                          <div className="flex items-center justify-between">
                             <div className="flex items-center gap-2">
                                <span className="text-xs">🇬🇪</span>
                                <label className="text-[10px] font-black uppercase tracking-widest text-[#dfb257]">{t.market.form.title} (GE)</label>
                             </div>
                             <span className="text-[8px] font-mono text-zinc-650">Optional Translation</span>
                          </div>
                          <div className="relative">
                             <input 
                                type="text"
                                value={formData.titleGe}
                                onChange={e => setFormData({...formData, titleGe: e.target.value})}
                                placeholder="მაგ: ინდუსტრიული მართვის პულტი"
                                className={cn(
                                   "w-full px-4.5 py-3.5 rounded-2xl border text-xs font-bold text-white shadow-inner transition-all",
                                   "bg-[#09090b]/90 border-zinc-850/80 focus:outline-none focus:border-[#dfb257] focus:ring-4 focus:ring-[#dfb257]/10 placeholder-zinc-600",
                                   currentTheme.input
                                )}
                             />
                          </div>
                       </div>
                    </div>
                 </motion.div>
              )}

              {/* STEP 2: Financials & Characteristics */}
              {formStep === 2 && (
                 <motion.div 
                    initial={{ opacity: 0, y: 15 }} 
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.35 }}
                    className="space-y-8 animate-in fade-in"
                 >
                    {/* Price and Currency input fields side-by-side */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                       <div className="space-y-3">
                          <label className="text-[10px] font-black uppercase tracking-widest text-[#dfb257] flex items-center gap-1.5">
                             <span>🪙</span> {t.market.form.price}
                          </label>
                          <div className="relative group">
                             <div className="absolute left-4.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                <Coins size={14} className="text-[#dfb257] opacity-70 group-focus-within:opacity-100 transition-opacity" />
                             </div>
                             <input 
                                required
                                type="number"
                                value={formData.price}
                                onChange={e => setFormData({...formData, price: e.target.value})}
                                placeholder="0.00"
                                className={cn(
                                   "w-full pl-11 pr-4 py-3.5 rounded-2xl border text-xs font-bold text-white shadow-inner transition-all",
                                   "bg-[#09090b]/90 border-zinc-850/80 focus:outline-none focus:border-[#dfb257] focus:ring-4 focus:ring-[#dfb257]/10 placeholder-zinc-600",
                                   currentTheme.input
                                )}
                             />
                          </div>
                       </div>

                       <div className="space-y-3">
                          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                             <span>💵</span> {t.market.form.currency}
                          </label>
                          <div className="relative group">
                             <select 
                                value={formData.currency}
                                onChange={e => setFormData({...formData, currency: e.target.value})}
                                className={cn(
                                   "w-full pl-4.5 pr-10 py-3.5 rounded-2xl border appearance-none text-xs font-mono font-bold text-white transition-all cursor-pointer",
                                   "bg-[#09090b]/90 border-zinc-850/80 focus:outline-none focus:border-[#dfb257] focus:ring-4 focus:ring-[#dfb257]/10",
                                   currentTheme.input
                                )}
                             >
                                {CURRENCIES.map(curr => (
                                   <option key={curr.code} value={curr.code} className="bg-zinc-950 text-white font-mono font-bold">
                                      {curr.code} ({curr.symbol})
                                   </option>
                                ))}
                             </select>
                             <ChevronDown size={14} className="absolute right-4.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none group-hover:text-zinc-300 transition-colors" />
                          </div>
                       </div>
                    </div>

                    {/* Product Condition Selection Header & Premium Sliding Tabs */}
                    <div className="space-y-4">
                       <label className="text-[10px] font-black uppercase tracking-widest text-[#dfb257] flex items-center gap-1.5">
                          <span>📦</span> {language === 'ka' ? 'აქტივის მდგომარეობა' : 'Asset Operational Condition'}
                       </label>
                       
                       {/* Interactive 3-Segment Navigation Switcher */}
                       <div className="grid grid-cols-3 gap-3 p-1.5 rounded-2xl bg-[#09090b]/90 border border-zinc-900">
                          {[
                             { id: 'new', icon: '✨', titleEn: 'Brand New', titleKa: 'ახალი-ახალი' },
                             { id: 'used', icon: '⚙️', titleEn: 'Used', titleKa: 'მეორადი' },
                             { id: 'refurbished', icon: '🛠️', titleEn: 'Restored', titleKa: 'აღდგენილი' }
                          ].map(cond => {
                             const isAct = formData.condition === cond.id;
                             return (
                                <button
                                   key={cond.id}
                                   type="button"
                                   onClick={() => setFormData({...formData, condition: cond.id})}
                                   className={cn(
                                      "py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex flex-col sm:flex-row items-center justify-center gap-1.5",
                                      isAct 
                                         ? "bg-[#dfb257] text-[#070708] shadow-[0_4px_12px_rgba(223,178,87,0.25)] scale-102"
                                         : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/40"
                                   )}
                                >
                                   <span className="text-xs">{cond.icon}</span>
                                   <span className="text-[9px] font-black">{language === 'ka' ? cond.titleKa : cond.titleEn}</span>
                                </button>
                             );
                          })}
                       </div>
                    </div>

                    {/* Beautiful Price Negotiable Box & Switch */}
                    <div className="p-1 px-4 py-3.5 rounded-2xl bg-zinc-950/70 border border-zinc-900/80 flex items-center justify-between gap-4">
                       <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-[#dfb257]/10 text-[#dfb257] border border-[#dfb257]/20">
                             <Tag size={14} className="stroke-[2.5]" />
                          </div>
                          <div>
                             <h4 className="text-xs font-black uppercase tracking-wider text-white">
                                {language === 'ka' ? 'ფასი შეთანხმებით' : 'Price Offer Open'}
                             </h4>
                             <p className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mt-0.5">
                                {language === 'ka' ? 'ფასი ექვემდებარება მოლაპარაკებას' : 'Listing allows open technical bids'}
                             </p>
                          </div>
                       </div>

                       <button
                          type="button"
                          onClick={() => setFormData({...formData, isNegotiable: !formData.isNegotiable})}
                          className={cn(
                             "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none",
                             formData.isNegotiable ? "bg-[#dfb257]" : "bg-zinc-850"
                          )}
                       >
                          <span
                             className={cn(
                                "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-300 ease-in-out",
                                formData.isNegotiable ? "translate-x-5" : "translate-x-0"
                             )}
                          />
                       </button>
                    </div>

                    {/* Service specific high-contrast characteristics */}
                    {formData.listingType === 'service' && (
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5 rounded-3xl bg-[#dfb257]/5 border border-[#dfb257]/15 shadow-inner">
                          <div className="space-y-3">
                             <label className="text-[9px] font-black uppercase tracking-wider text-[#dfb257] flex items-center gap-1 ml-0.5">
                                <span className="text-[10px]">⏱️</span> {language === 'ka' ? 'შესრულების ვადა' : 'Delivery Lead Time'}
                             </label>
                             <input 
                                type="text"
                                value={formData.serviceDuration || ''}
                                onChange={e => setFormData({...formData, serviceDuration: e.target.value})}
                                placeholder={language === 'ka' ? "მაგ: 3 დღე" : "e.g. 3 business days"}
                                className={cn(
                                   "w-full px-4 py-3 rounded-xl border text-xs font-bold text-white transition-all placeholder-zinc-650",
                                   "bg-[#09090b]/90 border-zinc-850/80 focus:outline-none focus:border-[#dfb257]",
                                   currentTheme.input
                                )}
                             />
                          </div>

                          <div className="space-y-3">
                             <label className="text-[9px] font-black uppercase tracking-wider text-[#dfb257] flex items-center gap-1 ml-0.5">
                                <span className="text-[10px]">📋</span> {language === 'ka' ? 'სამუშაო პირობები' : 'Technical Specifications Requirement'}
                             </label>
                             <input 
                                type="text"
                                value={formData.serviceTerms || ''}
                                onChange={e => setFormData({...formData, serviceTerms: e.target.value})}
                                placeholder={language === 'ka' ? "მაგ: სრული ტექნიკური დავალება" : "e.g. Detailed project specs"}
                                className={cn(
                                   "w-full px-4 py-3 rounded-xl border text-xs font-bold text-white transition-all placeholder-zinc-650",
                                   "bg-[#09090b]/90 border-zinc-850/80 focus:outline-none focus:border-[#dfb257]",
                                   currentTheme.input
                                )}
                             />
                          </div>
                       </div>
                    )}
                 </motion.div>
              )}

              {/* STEP 3: Location, Coordinates and Media Upload */}
              {formStep === 3 && (
                 <motion.div 
                    initial={{ opacity: 0, y: 15 }} 
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.35 }}
                    className="space-y-8 animate-in fade-in"
                 >
                    {/* Country and City Inputs Group */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                       <div className="space-y-3">
                          <label className="text-[10px] font-black uppercase tracking-widest text-[#dfb257] flex items-center gap-1.5">
                             <span>🗺️</span> {t.market.form.country}
                          </label>
                          <div className="relative group">
                             <select 
                                value={formData.country}
                                onChange={e => setFormData({...formData, country: e.target.value})}
                                className={cn(
                                   "w-full pl-4.5 pr-10 py-3.5 rounded-2xl border appearance-none text-xs font-bold text-white transition-all cursor-pointer",
                                   "bg-[#09090b]/90 border-zinc-850/80 focus:outline-none focus:border-[#dfb257] focus:ring-4 focus:ring-[#dfb257]/10",
                                   currentTheme.input
                                )}
                             >
                                {WORLD_COUNTRIES.filter(c => c.code !== 'GLOBAL').map(country => (
                                   <option key={country.code} value={country.code} className="bg-zinc-950 text-white font-bold text-xs py-1">
                                      {country.flag} {country.name}
                                   </option>
                                ))}
                             </select>
                             <ChevronDown size={14} className="absolute right-4.5 top-1/2 -translate-y-1/2 text-zinc-550 pointer-events-none group-hover:text-zinc-300 transition-colors" />
                          </div>
                       </div>

                       <div className="space-y-3">
                          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                             <span>🏙️</span> {t.market.form.city}
                          </label>
                          <div className="relative">
                             <input 
                                required
                                type="text"
                                value={formData.city}
                                onChange={e => setFormData({...formData, city: e.target.value})}
                                placeholder="e.g. Tbilisi"
                                className={cn(
                                   "w-full px-4.5 py-3.5 rounded-2xl border text-xs font-bold text-white shadow-inner transition-all placeholder-zinc-550",
                                   "bg-[#09090b]/90 border-zinc-850/80 focus:outline-none focus:border-[#dfb257] focus:ring-4 focus:ring-[#dfb257]/10",
                                   currentTheme.input
                                )}
                             />
                          </div>
                       </div>
                    </div>

                    {/* Address Location Input */}
                    <div className="space-y-3">
                       <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                          <span>📍</span> {t.market.form.location}
                       </label>
                       <div className="relative group">
                          <MapPin size={14} className="absolute left-4.5 top-1/2 -translate-y-1/2 text-zinc-550 group-focus-within:text-[#dfb257] transition-colors" />
                          <input 
                             type="text"
                             value={formData.location}
                             onChange={e => setFormData({...formData, location: e.target.value})}
                             placeholder="Detailed address directions..."
                             className={cn(
                                "w-full pl-11 pr-4 py-3.5 rounded-2xl border text-xs font-bold text-white shadow-inner transition-all placeholder-zinc-550",
                                "bg-[#09090b]/90 border-zinc-850/80 focus:outline-none focus:border-[#dfb257] focus:ring-4 focus:ring-[#dfb257]/10",
                                currentTheme.input
                             )}
                          />
                       </div>
                    </div>

                    {/* Interactive Map Coordinates Picker Container with Telemetry Frame */}
                    <div className="space-y-3">
                       <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black uppercase tracking-widest text-[#dfb257] flex items-center gap-1.5">
                             <span>🛰️</span> {language === 'ka' ? 'გეო-ლოკალური კოორდინირება' : 'Coordinate Telemetry Scope'}
                          </label>
                          <span className="text-[8px] font-mono text-zinc-550 block uppercase">
                             COORDS: {formData.lat.toFixed(4)}, {formData.lng.toFixed(4)}
                          </span>
                       </div>
                       
                       <div className="p-1 rounded-[28px] bg-black/60 border border-zinc-850/50 overflow-hidden shadow-2xl relative">
                          {/* Design-consistent Corner tech indicators */}
                          <div className="absolute top-3 left-4 text-[7px] font-mono font-black text-[#dfb257]/40 z-20 pointer-events-none uppercase tracking-widest">
                             GPS LINKED
                          </div>
                          <div className="absolute bottom-3 right-4 text-[7px] font-mono font-black text-zinc-650 z-20 pointer-events-none uppercase tracking-widest">
                             SYSTEM ACTIVE
                          </div>
                          
                          <div className="h-48 rounded-[24px] overflow-hidden">
                             <MapPicker 
                                lat={formData.lat}
                                lng={formData.lng}
                                onChange={(lat, lng) => setFormData(prev => ({ ...prev, lat, lng }))}
                                language={language}
                                currentTheme={currentTheme}
                             />
                          </div>
                       </div>
                    </div>

                    {/* Form Description and Spark AI Helper Button */}
                    <div className="space-y-3">
                       <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black uppercase tracking-widest text-[#dfb257] flex items-center gap-1.5">
                             <span>📋</span> {t.market.form.description}
                          </label>
                          
                          <button
                             type="button"
                             onClick={handleAiDescription}
                             disabled={isAiGenerating}
                             className={cn(
                                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                                "bg-gradient-to-r from-[#dfb257]/10 via-[#dfb257]/5 to-transparent border border-[#dfb257]/20 hover:border-[#dfb257]/70 text-[#dfb257] hover:shadow-[0_0_15px_rgba(223,178,87,0.15)] disabled:opacity-50"
                             )}
                          >
                             {isAiGenerating ? (
                                <Loader2 size={10} className="animate-spin" />
                             ) : (
                                <Sparkles size={10} className="stroke-[2.5] text-[#dfb257]" />
                             )}
                             {language === 'ka' ? 'AI შაბლონი' : 'AI Generate Specification'}
                          </button>
                       </div>
                       
                       <textarea 
                          required
                          value={formData.description}
                          onChange={e => setFormData({...formData, description: e.target.value})}
                          placeholder="Provide highly detailed product technical specifications..."
                          className={cn(
                             "w-full px-4.5 py-3.5 rounded-2xl border text-xs font-semibold h-36 resize-none text-white shadow-inner transition-all",
                             "bg-[#09090b]/95 border-zinc-850/80 focus:outline-none focus:border-[#dfb257] focus:ring-4 focus:ring-[#dfb257]/10 placeholder-zinc-650",
                             currentTheme.input
                          )}
                       />
                    </div>

                    {/* Graphic/Image upload box with scanners */}
                    <div className="space-y-3">
                       <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                          <span>🖼️</span> {t.market.form.image_url}
                       </label>
                       
                       <label 
                          className={cn(
                             "w-full h-44 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center gap-3 cursor-pointer transition-all overflow-hidden group relative",
                             (formData.images?.[0] || isResizing) 
                                ? "border-transparent bg-black/60 shadow-[0_8px_30px_rgb(0,0,0,0.8)]" 
                                : "bg-[#09090b]/60 border-zinc-850/70 hover:border-[#dfb257]/40 hover:bg-[#09090b]/90"
                          )}
                       >
                          {/* Decorative scanner line */}
                          {!formData.images?.[0] && !isResizing && (
                             <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#dfb257]/30 to-transparent group-hover:animate-ping pointer-events-none" />
                          )}
                          
                          <input 
                             type="file" 
                             onChange={handleFileUpload}
                             accept="image/*"
                             className="hidden"
                          />
                          
                          {isResizing ? (
                             <div className="flex flex-col items-center gap-2">
                                <Loader2 className="w-8 h-8 animate-spin text-[#dfb257]" />
                                <span className="text-[9px] font-black uppercase tracking-widest text-[#dfb257] tracking-widest">
                                   {language === 'ka' ? 'ინფორმაცია მუშავდება...' : 'Optimizing Visual Asset...'}
                                </span>
                             </div>
                          ) : formData.images?.[0] ? (
                             <div className="relative w-full h-full p-2.5">
                                <img 
                                   src={formData.images[0]} 
                                   className="w-full h-full object-cover rounded-2xl transition-transform duration-700 group-hover:scale-[1.03]" 
                                   alt={formData.title} 
                                />
                                
                                <div className="absolute bottom-5 left-5 bg-black/85 border border-[#dfb257]/30 px-3 py-1.5 rounded-xl backdrop-blur-md select-none pointer-events-none animate-fade-in">
                                   <div className="flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#dfb257] animate-pulse" />
                                      <span className="text-[8px] font-mono font-black text-white uppercase tracking-wider">
                                         ASSET READY
                                      </span>
                                   </div>
                                </div>
                                
                                <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-3xl duration-300">
                                   <span className="text-[9px] font-black uppercase tracking-widest text-[#dfb257] border border-[#dfb257]/30 bg-black/85 px-4.5 py-2.5 rounded-xl flex items-center gap-2 hover:scale-105 transition-all">
                                      <Camera size={12} className="text-[#dfb257]" /> 
                                      {language === 'ka' ? 'სურათის შეცვლა' : 'Replace Image Asset'}
                                   </span>
                                </div>
                             </div>
                          ) : (
                             <div className="flex flex-col items-center gap-3.5 select-none text-center px-6">
                                <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-900 group-hover:scale-105 transition-transform text-zinc-500 group-hover:text-[#dfb257] group-hover:border-[#dfb257]/30 group-hover:shadow-[0_0_15px_rgba(223,178,87,0.1)] duration-300">
                                   <Camera size={22} />
                                </div>
                                <div className="space-y-1">
                                   <span className="text-[10px] font-black text-zinc-400 block uppercase tracking-wider group-hover:text-white transition-colors">
                                      {t.market.form.upload_button}
                                   </span>
                                   <span className="text-[8px] font-semibold text-zinc-650 block uppercase tracking-widest">
                                      {language === 'ka' ? 'PNG, JPG ან WEBP (მაქს. 5MB)' : 'PNG, JPG or WEBP (Max 5MB)'}
                                   </span>
                                </div>
                             </div>
                          )}
                       </label>

                       <div className="relative mt-2.5 group">
                          <Link size={12} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-550 group-focus-within:text-[#dfb257] transition-colors" />
                          <input 
                             type="url"
                             value={formData.images?.[0] || ''}
                             onChange={e => setFormData({...formData, images: [e.target.value]})}
                             placeholder="...or paste external image link URL"
                             className={cn(
                                "w-full pl-10.5 pr-4 py-3 rounded-2xl border text-[11px] font-bold text-white shadow-inner transition-all placeholder-zinc-650",
                                "bg-[#09090b]/90 border-zinc-850/80 focus:outline-none focus:border-[#dfb257] focus:ring-4 focus:ring-[#dfb257]/10",
                                currentTheme.input
                             )}
                          />
                       </div>
                    </div>
                 </motion.div>
              )}

              {/* Steps Progress Footer Bar */}
              <div className="flex items-center justify-between gap-4 pt-8 mt-8 border-t border-zinc-900/80">
                 <div className="flex gap-2.5">
                    <button 
                       type="button"
                       onClick={() => setViewMode('browse')}
                       className="h-11 px-5 bg-zinc-950/80 hover:bg-zinc-90 w/80 hover:text-white border border-zinc-900 hover:border-zinc-800 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all text-zinc-400 flex items-center gap-2 shadow-inner"
                    >
                       <ArrowLeft size={13} />
                       {t.common.cancel}
                    </button>

                    {formStep > 1 && (
                       <button 
                          type="button"
                          onClick={() => setFormStep(prev => prev - 1)}
                          className="h-11 px-5 bg-zinc-950/80 hover:bg-zinc-90 w/80 border border-zinc-900 hover:border-zinc-800 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all text-white flex items-center gap-2"
                       >
                          <ChevronRight size={13} className="rotate-180 text-zinc-400" />
                          {language === 'ka' ? 'უკან' : 'Back'}
                       </button>
                    )}
                 </div>

                 <div className="flex gap-2.5">
                    {formStep < 3 ? (
                       <button 
                          type="button"
                          onClick={() => {
                             if (!formData.title.trim()) {
                                alert(language === 'ka' ? "გთხოვთ პირველ ნაბიჯზე შეიყვანოთ სათაური გასაგრძელებლად" : "Please input a title on Step 1 to continue.");
                                return;
                              }
                              setFormStep(prev => prev + 1);
                          }}
                          className="h-11 px-6 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 text-zinc-950 bg-[#dfb257] border border-[#dfb257] font-sans shadow-[0_4px_15px_rgba(223,178,87,0.25)]"
                       >
                          {language === 'ka' ? 'შემდეგი ნაბიჯი' : 'Next Step'}
                          <ChevronRight size={13} className="stroke-[2.5]" />
                       </button>
                    ) : (
                       <button 
                          disabled={isSubmitting}
                          className={cn(
                             "h-11 px-7 rounded-2xl text-[9px] font-black uppercase tracking-widest tracking-[0.18em] hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 text-black border border-[#dfb257] shadow-[0_6px_20px_rgba(223,178,87,0.3)]",
                             currentTheme.accentBg
                          )}
                       >
                          {isSubmitting ? <Loader2 size={13} className="animate-spin text-black" /> : <ShieldCheck size={15} className="stroke-[2.5]" />}
                          {viewMode === 'edit' ? t.market.form.update : t.market.form.submit}
                       </button>
                    )}
                 </div>
              </div>
           </form>
        </motion.div>
      )}`;

const startIndex = content.indexOf(startAnchor);
const endIndex = content.indexOf(endAnchor);

if (startIndex === -1) {
  console.error("Start anchor not found!");
  process.exit(1);
}

if (endIndex === -1) {
  console.error("End anchor not found!");
  process.exit(1);
}

const fullOriginalBlock = content.substring(startIndex, endIndex + endAnchor.length);
content = content.replace(fullOriginalBlock, replacementForm);

fs.writeFileSync(hubPath, content, 'utf8');
console.log("SUCCESS");

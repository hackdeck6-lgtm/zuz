import React, { useState, useEffect } from 'react';
import { 
  Heart, Droplet, Sparkles, BookOpen, MessageSquare, Info, 
  ChevronRight, ChevronDown, Menu, X, Award, Eye, ShieldCheck, HelpCircle,
  Check, Copy, AlertCircle, ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { HeartHandshake } from 'lucide-react';
import { Donation, ImpactStats } from './types';
import VideoPlayer from './components/VideoPlayer';
import DonationWidget from './components/DonationWidget';

// Durable-hosted official Assets for Zuzu for Africa
const officialLogo = 'https://cdn.durable.co/logos/14itIyxgyjv6xe08uxwm3o5Sz7WnGAph8kzxjDuOJfih5PtxuSRzFlmysnH4DGM1.png';
const heroCover = 'https://cdn.durable.co/covers/31Jguiela0OzJktJDRvqAEJOO6HNrkXE9vy5J3BSU9Ay8og5CiW5iVBkHyGOg6Zo.jpg';
const dentistVolunteer = '/src/assets/images/dentist_volunteer_africa_1784515841021.jpg';

// Imagens dos cards de impacto — selecionadas por tema (crianças africanas, refeição,
// saúde odontológica, savana angolana, material escolar). Alta resolução p/ nitidez.
const cardImages = {
  children: 'https://images.unsplash.com/photo-1509099836639-18ba1795216d?q=80&w=800&auto=format&fit=crop',
  meals: 'https://images.unsplash.com/photo-1547592180-85f173990554?q=80&w=800&auto=format&fit=crop',
  health: 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?q=80&w=800&auto=format&fit=crop',
  angola: 'https://images.unsplash.com/photo-1523805009345-7448845a9e53?q=80&w=800&auto=format&fit=crop',
  kits: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=800&auto=format&fit=crop',
};

export default function App() {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [stats, setStats] = useState<ImpactStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDefaultAmount, setSelectedDefaultAmount] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Perguntas frequentes — respostas ancoradas em dados públicos e verificáveis da ONG.
  const faqs = [
    {
      q: 'O que é a Zuzu for Africa?',
      a: 'A Zuzu for Africa é uma organização não governamental (ONG) fundada em 2017, que desde 2019 realiza missões humanitárias em Angola. O objetivo é resgatar a infância de crianças em situação de extrema pobreza, levando alimentação, saúde e educação às comunidades atendidas.',
    },
    {
      q: 'Em qual país e regiões o projeto atua?',
      a: 'A atuação principal é em Angola, onde a ONG realiza missões periódicas junto a comunidades locais. Cerca de 38% das crianças no país convivem com desnutrição crônica (dados da UNICEF), o que torna cada missão especialmente urgente.',
    },
    {
      q: 'Para onde vai a minha contribuição?',
      a: 'As contribuições são destinadas ao trabalho de campo da ONG: as mais de 800 refeições distribuídas por dia durante as missões, o atendimento médico e odontológico, e os kits de higiene, material escolar e brinquedos entregues às crianças.',
    },
    {
      q: 'Como será feito o pagamento?',
      a: 'O pagamento é feito por Pix, de forma rápida e segura. Ao escolher o valor e informar seus dados, geramos um QR Code (e um código Pix copia e cola) para você concluir a doação direto no app do seu banco. Assim que o pagamento é confirmado, você recebe um e-mail de confirmação. Este site não solicita dados de cartão.',
    },
    {
      q: 'Como sei que este é o canal oficial?',
      a: 'Este site é uma página de apoio ao projeto. A ONG mantém canais oficiais próprios (site, redes sociais e conta com CNPJ registrado). O pagamento aqui é feito exclusivamente via Pix — nunca pedimos dados de cartão. Antes de doar, confira sempre se o destino corresponde aos canais oficiais divulgados pela própria Zuzu for Africa.',
    },
    {
      q: 'Vou receber comprovante ou prestação de contas?',
      a: 'Sim. Assim que seu Pix é confirmado, enviamos um e-mail de confirmação da sua doação. A prestação de contas e o acompanhamento das missões são divulgados pela ONG em seus canais oficiais e nas redes sociais, onde é possível ver os registros das entregas realizadas.',
    },
    {
      q: 'Posso ajudar de outras formas além de doar?',
      a: 'Sim. Divulgar o projeto, compartilhar as publicações das missões e acompanhar o trabalho nas redes sociais também fortalece a causa e ajuda a alcançar mais pessoas dispostas a apoiar.',
    },
  ];

  // Load donations and stats from the backend
  const fetchBoardData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/donations');
      const data = await response.json();
      if (data.success) {
        setDonations(data.donations);
        setStats(data.totals);
      }
    } catch (error) {
      console.error('Error fetching board data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBoardData();
  }, []);

  const handleDonationComplete = async (name: string, amount: number, message: string) => {
    try {
      const response = await fetch('/api/donations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, amount, message }),
      });
      const data = await response.json();
      if (data.success) {
        fetchBoardData();
      }
    } catch (error) {
      console.error('Error posting donation:', error);
    }
  };

  const scrollToSection = (id: string) => {
    const section = document.getElementById(id);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setMobileMenuOpen(false);
  };

  const openDonationModal = () => {
    setIsDonationModalOpen(true);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#faf8f6] flex flex-col justify-between font-sans selection:bg-terracotta-200 selection:text-terracotta-900">
      
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-[#faf8f6]/95 backdrop-blur-md border-b border-stone-200/50">
        {/* Faixa fina nas cores pan-africanas (verde · amarelo · vermelho) */}
        <div className="absolute bottom-0 inset-x-0 h-[3px] bg-gradient-to-r from-emerald-600 via-amber-400 to-red-600 opacity-80" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">

          {/* Official Logo with Elephant Heart */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <img 
              src={officialLogo} 
              alt="Zuzu for Africa" 
              className="h-14 w-auto object-contain"
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Navigation Links — uppercase Spartan */}
          <nav className="hidden md:flex items-center gap-8 font-display text-sm font-bold tracking-wider uppercase">
            <button onClick={() => scrollToSection('about-section')} className="text-stone-800 hover:text-terracotta-600 transition-colors cursor-pointer">
              Quem Somos
            </button>
            <button onClick={() => scrollToSection('stats-grid')} className="text-stone-800 hover:text-terracotta-600 transition-colors cursor-pointer">
              Missões
            </button>
            <button onClick={() => scrollToSection('donation-hub')} className="text-stone-800 hover:text-terracotta-600 transition-colors cursor-pointer">
              Mural
            </button>
            <button onClick={() => scrollToSection('footer-section')} className="text-stone-800 hover:text-terracotta-600 transition-colors cursor-pointer">
              Contato
            </button>
          </nav>

          {/* Coraçõezinhos decorativos + CTA terracota */}
          <div className="hidden lg:flex items-center gap-4">
            {/* Trio de corações nas cores quentes da África */}
            <div className="flex items-center gap-1.5">
              <Heart size={14} className="fill-current text-terracotta-600" />
              <Heart size={16} className="fill-current text-amber-500" />
              <Heart size={14} className="fill-current text-terracotta-400" />
            </div>

            <button
              onClick={openDonationModal}
              className="group px-6 py-2.5 rounded-full bg-gradient-to-r from-terracotta-600 to-amber-500 hover:brightness-105 text-white font-display font-bold text-sm tracking-widest uppercase transition-all shadow-sm cursor-pointer flex items-center gap-2"
            >
              <Heart size={15} className="fill-current group-hover:scale-110 transition-transform" />
              DOE AGORA
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-stone-800 hover:bg-stone-200/50 rounded-xl transition-colors cursor-pointer"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-stone-200/60 bg-[#faf8f6]"
            >
              <div className="px-6 py-5 space-y-4 flex flex-col font-display text-sm font-bold tracking-wider uppercase">
                <button onClick={() => scrollToSection('about-section')} className="text-left text-stone-800">
                  Quem Somos
                </button>
                <button onClick={() => scrollToSection('stats-grid')} className="text-left text-stone-800">
                  Missões
                </button>
                <button onClick={() => scrollToSection('donation-hub')} className="text-left text-stone-800">
                  Mural
                </button>
                <button onClick={() => scrollToSection('footer-section')} className="text-left text-stone-800">
                  Contato
                </button>
                <div className="border-t border-stone-200/60 pt-4 flex flex-col gap-4">
                  <button
                    onClick={openDonationModal}
                    className="w-full py-3 rounded-full bg-gradient-to-r from-terracotta-600 to-amber-500 text-white font-bold text-center tracking-widest uppercase flex items-center justify-center gap-2"
                  >
                    <Heart size={16} className="fill-current" />
                    DOE AGORA
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* MAIN BODY CONTAINER */}
      <main className="flex-grow">

        {/* VSL SECTION: player de vídeo em destaque, logo abaixo do header */}
        <section className="relative overflow-hidden bg-brand-dark pt-12 pb-16 sm:pt-16 sm:pb-20">
          {/* Halo terracota com respiração sutil atrás do vídeo */}
          <motion.div
            aria-hidden
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] rounded-full bg-terracotta-500/15 blur-[90px] pointer-events-none"
            animate={{ opacity: [0.6, 0.85, 0.6] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(100%_100%_at_100%_100%,rgba(242,202,44,0.10),transparent_55%)] pointer-events-none" />

          <div className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 text-center flex flex-col items-center gap-6">

            <motion.span
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-terracotta-500/15 border border-terracotta-400/30 text-terracotta-200 font-display text-xs font-bold tracking-widest uppercase"
            >
              <Sparkles size={12} /> Missão em Angola · Desde 2019
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="font-display text-3xl sm:text-5xl font-black text-white tracking-tight leading-[1.05] uppercase"
            >
              Veja de perto a infância que estamos resgatando
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="font-sans text-stone-300 text-base sm:text-lg max-w-xl leading-relaxed"
            >
              Um minuto no chão das nossas missões, com as crianças que recebem comida, saúde e escola. É o que o seu apoio ajuda a manter.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-[300px] sm:max-w-[340px] my-2"
            >
              <VideoPlayer badge="Angola · Missões" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col items-center gap-3"
            >
              <button
                onClick={openDonationModal}
                className="px-10 py-4 rounded-full bg-gradient-to-r from-terracotta-600 to-amber-500 hover:scale-[1.02] hover:brightness-105 text-white font-display font-black text-sm tracking-widest uppercase transition-all shadow-lg shadow-terracotta-600/25 cursor-pointer flex items-center gap-2"
              >
                <Heart size={18} className="fill-current" /> Quero Apoiar
              </button>
              <p className="text-stone-400 text-xs">
                Doe agora via Pix. Escolha o valor e conclua a doação em segundos.
              </p>
            </motion.div>

          </div>
        </section>

        {/* HERO SECTION: Absolute visual parity with Durable cover */}
        <section className="relative min-h-[640px] py-16 sm:py-24 flex items-center justify-center bg-cover bg-center" style={{ backgroundImage: `url('${heroCover}')` }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px]" />
          <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
            
            <div className="space-y-4">
              <span className="inline-block px-4 py-1.5 rounded-full bg-terracotta-500/10 border border-terracotta-500/20 text-terracotta-400 font-display text-xs font-bold tracking-widest uppercase">
                MISSÃO SOLIDÁRIA ATIVA
              </span>
              <h2 className="font-display text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-[1.05] max-w-4xl mx-auto">
                JUNTOS, RESGATAMOS INFÂNCIAS EM ANGOLA
              </h2>
              <p className="font-sans text-stone-200 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
                Em Angola, cerca de 38% das crianças convivem com a desnutrição crônica. Desde 2019, a Zuzu for Africa leva a essas comunidades mais de 800 refeições por dia, atendimento médico e odontológico, kits de higiene e material escolar. Cada missão devolve a uma criança o direito de ser criança — e o seu apoio faz parte disso.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={openDonationModal}
                className="px-8 py-4 rounded-full bg-gradient-to-r from-terracotta-600 to-amber-500 hover:scale-105 text-white font-display font-black text-sm tracking-widest uppercase transition-all shadow-lg shadow-terracotta-600/20 cursor-pointer"
              >
                QUERO APOIAR
              </button>
              <button
                onClick={() => scrollToSection('about-section')}
                className="px-8 py-4 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-display font-black text-sm tracking-widest uppercase transition-all cursor-pointer"
              >
                CONHECER HISTÓRIA
              </button>
            </div>

          </div>
        </section>

        {/* STATS IMPACT GRID: Exactly matching reference bottom section layout */}
        <section id="stats-grid" className="py-20 bg-white border-y border-stone-200/40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
              <span className="text-xs font-black text-terracotta-600 uppercase tracking-widest">
                NOSSAS CONQUISTAS
              </span>
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight leading-none uppercase">
                O IMPACTO REAL DO SEU APOIO
              </h2>
              <p className="text-stone-500 text-sm font-sans">
                O trabalho da Zuzu for Africa em números — o resultado de cada missão realizada em Angola.
              </p>
            </div>

            {/* Grid layout with full overlay matching Durable visual theme */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              
              {/* Card 1 */}
              <div className="group relative h-56 rounded-2xl overflow-hidden shadow-md">
                <div 
                  className="absolute inset-0 bg-cover bg-center group-hover:scale-105 transition-transform duration-500" 
                  style={{ backgroundImage: `url('${cardImages.children}')` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-black/35 flex flex-col justify-end p-5 text-center" />
                <div className="relative z-10 flex flex-col items-center justify-end h-full p-5 text-center">
                  <span className="font-display text-4xl font-black text-amber-400">+1.300</span>
                  <span className="text-[11px] font-bold text-white uppercase tracking-wider mt-1.5 leading-snug">
                    Crianças atendidas
                  </span>
                </div>
              </div>

              {/* Card 2 */}
              <div className="group relative h-56 rounded-2xl overflow-hidden shadow-md">
                <div 
                  className="absolute inset-0 bg-cover bg-center group-hover:scale-105 transition-transform duration-500" 
                  style={{ backgroundImage: `url('${cardImages.meals}')` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-black/35 flex flex-col justify-end p-5 text-center" />
                <div className="relative z-10 flex flex-col items-center justify-end h-full p-5 text-center">
                  <span className="font-display text-4xl font-black text-amber-400">+800</span>
                  <span className="text-[11px] font-bold text-white uppercase tracking-wider mt-1.5 leading-snug">
                    Refeições por dia
                  </span>
                </div>
              </div>

              {/* Card 3 */}
              <div className="group relative h-56 rounded-2xl overflow-hidden shadow-md">
                <div 
                  className="absolute inset-0 bg-cover bg-center group-hover:scale-105 transition-transform duration-500" 
                  style={{ backgroundImage: `url('${dentistVolunteer}')` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-black/35 flex flex-col justify-end p-5 text-center" />
                <div className="relative z-10 flex flex-col items-center justify-end h-full p-5 text-center">
                  <span className="font-display text-4xl font-black text-amber-400">Saúde</span>
                  <span className="text-[11px] font-bold text-white uppercase tracking-wider mt-1.5 leading-snug">
                    Atendimento médico e odontológico
                  </span>
                </div>
              </div>

              {/* Card 4 */}
              <div className="group relative h-56 rounded-2xl overflow-hidden shadow-md">
                <div 
                  className="absolute inset-0 bg-cover bg-center group-hover:scale-105 transition-transform duration-500" 
                  style={{ backgroundImage: `url('${cardImages.angola}')` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-black/35 flex flex-col justify-end p-5 text-center" />
                <div className="relative z-10 flex flex-col items-center justify-end h-full p-5 text-center">
                  <span className="font-display text-4xl font-black text-amber-400">2019</span>
                  <span className="text-[11px] font-bold text-white uppercase tracking-wider mt-1.5 leading-snug">
                    Atuando em Angola desde
                  </span>
                </div>
              </div>

              {/* Card 5 */}
              <div className="group relative h-56 rounded-2xl overflow-hidden shadow-md">
                <div 
                  className="absolute inset-0 bg-cover bg-center group-hover:scale-105 transition-transform duration-500" 
                  style={{ backgroundImage: `url('${cardImages.kits}')` }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-black/35 flex flex-col justify-end p-5 text-center" />
                <div className="relative z-10 flex flex-col items-center justify-end h-full p-5 text-center">
                  <span className="font-display text-4xl font-black text-amber-400">Kits</span>
                  <span className="text-[11px] font-bold text-white uppercase tracking-wider mt-1.5 leading-snug">
                    Higiene, material escolar e brinquedos
                  </span>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* BENTO HISTÓRIA SECTION */}
        <section id="about-section" className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto space-y-3 mb-16">
              <span className="text-xs font-black text-terracotta-600 uppercase tracking-widest">
                QUEM SOMOS
              </span>
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight leading-none uppercase">
                COMO NASCEU O PROJETO ZUZU
              </h2>
              <p className="text-stone-500 text-sm font-sans">
                Conheça a história e o legado familiar inspirador por trás da nossa missão.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              
              {/* Box 1 */}
              <div className="md:col-span-7 bg-[#faf8f6] rounded-3xl p-6 md:p-8 border border-stone-200/50 flex flex-col justify-between relative overflow-hidden">
                <div className="space-y-4">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-terracotta-700 bg-terracotta-500/10 px-2.5 py-1 rounded-md">
                    Nossa Missão
                  </span>
                  <h3 className="font-display text-2xl font-extrabold text-stone-900 leading-none">
                    Uma Missão Humanitária em Angola
                  </h3>
                  <p className="text-stone-600 text-sm leading-relaxed font-sans">
                    Fundada em 2017, a Zuzu for Africa atua desde 2019 em Angola com um propósito claro: resgatar a infância de crianças que vivem em situação de extrema pobreza. Em um país onde cerca de 38% das crianças sofrem de desnutrição crônica, cada missão leva atendimento médico e odontológico, kits de higiene, material escolar e mais de 800 refeições por dia diretamente a quem mais precisa.
                  </p>
                </div>
                <div className="border-t border-stone-300/60 pt-4 mt-6 flex justify-between items-center text-xs text-stone-500">
                  <span className="italic">"Transformar realidades, uma criança de cada vez."</span>
                  <span className="font-bold text-stone-700">Zuzu for Africa</span>
                </div>
              </div>

              {/* Box 2 */}
              <div className="md:col-span-5 bg-brand-dark text-white rounded-3xl p-6 md:p-8 flex flex-col justify-between relative overflow-hidden">
                <div className="space-y-4">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400 bg-white/10 px-2.5 py-1 rounded-md">
                    Odontologia Móvel
                  </span>
                  <h3 className="font-display text-2xl font-extrabold text-amber-400 leading-none">
                    Sorrisos Livres de Dor
                  </h3>
                  <p className="text-stone-300 text-sm leading-relaxed font-sans">
                    As missões levam atendimento odontológico e médico às comunidades de Angola, distribuindo kits de higiene, medicamentos, brinquedos e material escolar para crianças que raramente têm acesso a esse cuidado.
                  </p>
                </div>
                <div className="pt-6 mt-4 border-t border-stone-800">
                  <p className="text-[11px] font-bold text-stone-400">
                    Mais de 800 refeições distribuídas por dia durante as missões.
                  </p>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* SUPPORTERS LOGOS STRIP */}
        <section className="py-12 bg-[#faf8f6] border-b border-stone-200/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <p className="font-display text-xs font-bold text-stone-500 uppercase tracking-widest">
              APOIADORES que somam propósito e fazem a diferença com a Zuzu.
            </p>
            <div className="flex flex-wrap justify-center items-center gap-10 md:gap-16 opacity-65">
              <span className="font-display font-black text-xl text-stone-700 select-none">CLUBE DA ANULINHA</span>
              <span className="font-display font-black text-2xl text-stone-700 italic select-none">inova</span>
              <span className="font-display font-black text-xl text-stone-700 select-none">NETVISTOS</span>
              <span className="font-display font-black text-xl text-stone-700 uppercase tracking-tight select-none">Patota do Caboclo</span>
            </div>
          </div>
        </section>

        {/* FAQ ACCORDION SECTION */}
        <section className="py-16 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center space-y-2 mb-12">
              <span className="text-xs font-black text-terracotta-600 uppercase tracking-widest">
                DÚVIDAS COMUNS
              </span>
              <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-stone-900 uppercase">PERGUNTAS FREQUENTES</h3>
              <p className="text-stone-500 text-xs">Tem alguma dúvida sobre transparência, repasse ou como apoiar? Nós respondemos.</p>
            </div>

            <div className="space-y-3">
              {faqs.map((item, index) => {
                const isOpen = openFaq === index;
                return (
                  <div
                    key={index}
                    className={`border rounded-2xl overflow-hidden transition-colors ${
                      isOpen ? 'border-terracotta-300 bg-white shadow-sm' : 'border-stone-200 bg-[#faf8f6]/50'
                    }`}
                  >
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : index)}
                      className="w-full flex items-center justify-between gap-3 p-5 text-left cursor-pointer"
                      aria-expanded={isOpen}
                    >
                      <span className="font-sans font-bold text-stone-900 text-sm flex gap-2.5 items-center">
                        <HelpCircle size={16} className="text-terracotta-600 shrink-0" />
                        {item.q}
                      </span>
                      <ChevronDown
                        size={18}
                        className={`text-stone-400 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180 text-terracotta-600' : ''}`}
                      />
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: 'easeInOut' }}
                          className="overflow-hidden"
                        >
                          <p className="text-stone-600 text-xs sm:text-sm px-5 pb-5 pl-13 leading-relaxed">
                            {item.a}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            {/* CTA suave no fim do FAQ */}
            <div className="mt-10 text-center">
              <p className="text-stone-500 text-xs mb-4">Ainda tem dúvidas? Acompanhe as missões nas redes oficiais do projeto.</p>
              <button
                onClick={openDonationModal}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-terracotta-600 to-amber-500 hover:brightness-105 text-white font-display font-bold text-xs tracking-widest uppercase transition-all shadow-sm cursor-pointer"
              >
                Quero Apoiar <ArrowRight size={16} />
              </button>
            </div>

          </div>
        </section>

      </main>

      {/* FOOTER */}
      <footer id="footer-section" className="bg-brand-dark text-stone-400 border-t border-stone-800 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            
            {/* Branding */}
            <div className="col-span-1 md:col-span-2 space-y-4">
              <img 
                src={officialLogo} 
                alt="Zuzu for Africa Logo" 
                className="h-16 w-auto object-contain brightness-0 invert"
                referrerPolicy="no-referrer"
              />
              <p className="text-stone-400 text-xs max-w-sm font-sans leading-relaxed">
                Plataforma independente de captação de recursos criada para apoiar a ONG Zuzu for Africa. Nenhuma taxa administrativa é descontada do repasse de ajuda humanitária.
              </p>
              <div className="text-stone-500 text-[10px] font-mono">
                © 2026 Zuzu for Africa. Todos os direitos reservados.
              </div>
            </div>

            {/* Navigation links */}
            <div className="space-y-3">
              <h5 className="font-display font-bold text-xs uppercase tracking-wider text-white">Navegação</h5>
              <div className="flex flex-col gap-2 text-xs">
                <button onClick={() => scrollToSection('about-section')} className="text-left text-stone-400 hover:text-white transition-colors cursor-pointer">Quem Somos</button>
                <button onClick={() => scrollToSection('stats-grid')} className="text-left text-stone-400 hover:text-white transition-colors cursor-pointer">Missões Ativas</button>
                <button onClick={openDonationModal} className="text-left font-bold text-terracotta-400 hover:text-terracotta-300 transition-colors cursor-pointer">Quero Contribuir</button>
                <button onClick={() => scrollToSection('footer-section')} className="text-left text-stone-400 hover:text-white transition-colors cursor-pointer">Contato / Transferência</button>
              </div>
            </div>

            {/* Support info */}
            <div className="space-y-3">
              <h5 className="font-display font-bold text-xs uppercase tracking-wider text-white">Contato & Apoio</h5>
              <p className="text-xs text-stone-400 font-sans leading-relaxed">
                Dúvidas técnicas ou solicitações de prestação de contas específicas:
              </p>
              <div className="text-xs text-terracotta-400 font-mono font-semibold">
                apoio@zuzuforafrica.com
              </div>
            </div>

          </div>

          <div className="border-t border-stone-800 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] text-stone-500 font-mono">
            <div>
              Hospedado de forma segura em infraestrutura autorizada.
            </div>
            
            <div className="flex items-center gap-1">
              <ShieldCheck size={12} className="text-terracotta-500" />
              <span>Pagamento via Pix, com confirmação instantânea</span>
            </div>
          </div>
        </div>
      </footer>

      {/* MODAL DE DOAÇÃO: reaproveita o DonationWidget multi-etapas */}
      <AnimatePresence>
        {isDonationModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDonationModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            {/* Corpo do modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-stone-100 overflow-hidden z-10 text-stone-900"
            >
              {/* Barra superior do modal */}
              <div className="bg-stone-50 px-6 py-4 border-b border-stone-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-terracotta-100 text-terracotta-600 flex items-center justify-center">
                    <HeartHandshake size={16} />
                  </div>
                  <div>
                    <h3 className="font-display font-black text-sm tracking-widest uppercase text-stone-900">Quero Apoiar</h3>
                    <p className="text-[10px] text-stone-400 font-semibold uppercase tracking-wider">Doe agora via Pix — confirmação instantânea</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsDonationModalOpen(false)}
                  className="p-1.5 rounded-full hover:bg-stone-200/50 text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* DonationWidget rolável */}
              <div className="max-h-[80vh] overflow-y-auto p-6">
                <DonationWidget
                  onDonationComplete={(name, amount, msg) => {
                    handleDonationComplete(name, amount, msg);
                  }}
                  selectedDefaultAmount={selectedDefaultAmount}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

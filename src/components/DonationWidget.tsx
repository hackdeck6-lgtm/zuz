import React, { useState, useEffect } from 'react';
import { Check, Heart, ArrowRight, Loader2, Mail, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DonationWidgetProps {
  onDonationComplete: (name: string, amount: number, message: string) => void;
  selectedDefaultAmount?: number | null;
}

export default function DonationWidget({ onDonationComplete, selectedDefaultAmount }: DonationWidgetProps) {
  // 1: Amount, 2: Info + join support list, 3: Confirmation (NO payment yet)
  const [step, setStep] = useState(1);
  const [amount, setAmount] = useState<number>(50);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isCustom, setIsCustom] = useState(false);

  // Form fields (supporter contact only — NO card/CVV/payment data is collected)
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (selectedDefaultAmount) {
      if ([30, 50, 100, 250].includes(selectedDefaultAmount)) {
        setAmount(selectedDefaultAmount);
        setIsCustom(false);
      } else {
        setAmount(selectedDefaultAmount);
        setCustomAmount(String(selectedDefaultAmount));
        setIsCustom(true);
      }
    }
  }, [selectedDefaultAmount]);

  const handleAmountSelect = (val: number) => {
    setAmount(val);
    setIsCustom(false);
    setCustomAmount('');
  };

  const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    setCustomAmount(val);
    setAmount(val ? Number(val) : 0);
  };

  const handleInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;
    setIsSubmitting(true);
    // Records the person on the supporter/interest list. This does NOT move money —
    // real payment (Stripe) will be wired in later, once approved by the project team.
    await new Promise((resolve) => setTimeout(resolve, 900));
    setIsSubmitting(false);
    onDonationComplete(name, amount, message);
    setStep(3);
  };

  const getImpactDescription = (val: number) => {
    if (val <= 0) return 'Digite um valor que você pretende contribuir quando o pagamento estiver ativo.';
    if (val <= 30) {
      return `R$ ${val} ajudam a montar kits de higiene oral (escova e creme dental) para crianças nas aldeias parceiras.`;
    } else if (val <= 50) {
      return `R$ ${val} ajudam a manter refeições nutritivas para crianças em situação de fome ao longo do mês.`;
    } else if (val <= 100) {
      return `R$ ${val} ajudam a levar atendimento médico e odontológico às comunidades atendidas.`;
    } else if (val <= 250) {
      return `R$ ${val} apoiam material escolar, brinquedos e itens de cuidado para as crianças.`;
    } else {
      return `R$ ${val} patrocinam um pacote maior de ajuda: alimentação, saúde e educação para mais crianças.`;
    }
  };

  return (
    <div id="donation-widget" className="bg-white rounded-3xl shadow-xl overflow-hidden border border-stone-100 flex flex-col justify-between h-full min-h-[520px]">
      {/* Widget Header */}
      <div className="bg-gradient-to-r from-terracotta-600 to-amber-500 p-6 text-white flex justify-between items-center">
        <div>
          <span className="text-xs uppercase font-bold tracking-widest text-terracotta-100">
            Fazer a Diferença
          </span>
          <h3 className="font-display text-xl font-bold">Quero Apoiar</h3>
        </div>
        <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-semibold">
          <Clock size={14} /> Pagamento em breve
        </div>
      </div>

      {/* Step Progress indicators */}
      <div className="px-6 pt-5 flex items-center justify-between text-xs text-stone-400 font-medium">
        {[1, 2].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
              step === s
                ? 'bg-amber-500 text-stone-900 shadow-md shadow-amber-500/10'
                : step > s
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-400'
            }`}>
              {step > s ? <Check size={12} /> : s}
            </div>
            <span className={step === s ? 'text-stone-900 font-semibold' : ''}>
              {s === 1 ? 'Valor' : 'Seus dados'}
            </span>
            {s < 2 && <div className="w-6 h-[1px] bg-stone-200 hidden md:block" />}
          </div>
        ))}
      </div>

      {/* Main Form Body */}
      <div className="p-6 flex-grow flex flex-col justify-center">
        <AnimatePresence mode="wait">

          {/* Step 1: Amount */}
          {step === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 15 }}
              className="space-y-5"
            >
              <p className="text-stone-500 text-sm">
                Escolha um valor de referência. Ele indica quanto você pretende contribuir quando o pagamento estiver disponível:
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[30, 50, 100, 250].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => handleAmountSelect(val)}
                    className={`py-3.5 px-4 rounded-2xl border font-display font-bold text-lg flex flex-col items-center justify-center transition-all duration-200 cursor-pointer ${
                      amount === val && !isCustom
                        ? 'border-terracotta-600 bg-terracotta-50 text-terracotta-800 shadow-md ring-2 ring-terracotta-500/10'
                        : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700 hover:border-stone-300'
                    }`}
                  >
                    <span className="text-xs text-stone-400 font-normal">R$</span>
                    {val}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsCustom(true);
                    setAmount(Number(customAmount) || 0);
                  }}
                  className={`w-full py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all border flex items-center justify-center gap-1 cursor-pointer ${
                    isCustom
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-700'
                      : 'border-dashed border-stone-300 text-stone-500 hover:border-stone-400 hover:text-stone-700'
                  }`}
                >
                  {isCustom ? '✓ Outro valor ativo' : '+ Definir Outro Valor'}
                </button>

                {isCustom && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="relative"
                  >
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 font-bold">R$</span>
                    <input
                      type="text"
                      pattern="[0-9]*"
                      inputMode="numeric"
                      value={customAmount}
                      onChange={handleCustomAmountChange}
                      placeholder="Digite o valor (Ex: 80, 500)"
                      className="w-full pl-10 pr-4 py-3.5 rounded-2xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-terracotta-500/20 focus:border-terracotta-500 font-semibold text-stone-800"
                    />
                  </motion.div>
                )}
              </div>

              <div className="bg-stone-50 border border-stone-100 rounded-2xl p-4 flex gap-3.5 items-start">
                <div className="p-2.5 bg-amber-500/10 text-amber-600 rounded-xl">
                  <Heart size={20} className="fill-current" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider">Impacto do seu apoio</h4>
                  <p className="text-stone-700 text-sm font-medium mt-1 leading-relaxed">
                    {getImpactDescription(amount)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={amount <= 0}
                onClick={() => setStep(2)}
                className="w-full py-4 rounded-2xl bg-stone-900 hover:bg-stone-800 text-white font-bold tracking-wide flex items-center justify-center gap-1.5 shadow-lg shadow-stone-900/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                CONTINUAR <ArrowRight size={18} />
              </button>
            </motion.div>
          )}

          {/* Step 2: Contact info — supporter list only, NO payment data */}
          {step === 2 && (
            <motion.form
              key="step-2"
              onSubmit={handleInfoSubmit}
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 15 }}
              className="space-y-4"
            >
              <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3 flex gap-2 items-start">
                <Clock size={16} className="text-amber-600 mt-0.5 shrink-0" />
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  A cobrança ainda <strong>não está ativa</strong>. Ao continuar, você entra na lista de apoiadores e recebe o link de pagamento seguro (Stripe) assim que ele for liberado. Nenhum dado de cartão é solicitado aqui.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Como quer aparecer no mural de apoiadores"
                  className="w-full px-4 py-3.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-terracotta-500/20 focus:border-terracotta-500 text-sm font-medium"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">Seu Melhor E-mail</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@email.com"
                    className="w-full px-4 py-3.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-terracotta-500/20 focus:border-terracotta-500 text-sm font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">WhatsApp (Opcional)</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="w-full px-4 py-3.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-terracotta-500/20 focus:border-terracotta-500 text-sm font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">Mensagem de Apoio (Opcional)</label>
                  <span className="text-stone-400 text-xs font-medium">Aparecerá no mural</span>
                </div>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Escreva uma palavra de carinho para a equipe e as crianças!"
                  maxLength={180}
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-terracotta-500/20 focus:border-terracotta-500 text-sm font-medium resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-1/3 py-4 rounded-xl border border-stone-200 text-stone-500 font-bold text-sm tracking-wide hover:bg-stone-50 transition-all cursor-pointer"
                >
                  VOLTAR
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-2/3 py-4 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold tracking-wide flex items-center justify-center gap-1.5 shadow-lg shadow-stone-900/10 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <><Loader2 className="animate-spin" size={18} /> Registrando...</>
                  ) : (
                    <>ENTRAR NA LISTA DE APOIO <ArrowRight size={16} /></>
                  )}
                </button>
              </div>
            </motion.form>
          )}

          {/* Step 3: Honest confirmation — on the support list, payment pending */}
          {step === 3 && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-6 py-4"
            >
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 border-4 border-emerald-500/10 flex items-center justify-center text-emerald-600">
                <Check size={32} strokeWidth={3} />
              </div>

              <div className="space-y-1">
                <h4 className="font-display text-xl font-bold text-stone-900">Você está na lista de apoio! 💛</h4>
                <p className="text-stone-500 text-sm">
                  Obrigado, <strong className="text-stone-800">{name || 'apoiador(a)'}</strong>. Sua mensagem foi adicionada ao mural.
                </p>
              </div>

              <div className="border border-amber-200 bg-amber-50/40 rounded-2xl p-5 text-left flex gap-3">
                <Mail className="text-amber-600 shrink-0 mt-0.5" size={20} />
                <p className="text-stone-700 text-sm leading-relaxed">
                  Assim que o pagamento seguro (Stripe) for ativado, enviaremos para <strong className="text-stone-900">{email || 'seu e-mail'}</strong> o link oficial para concluir sua contribuição de <strong className="text-amber-700">R$ {amount}</strong>. Nenhum valor foi cobrado agora.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setAmount(50);
                  setName('');
                  setEmail('');
                  setPhone('');
                  setMessage('');
                }}
                className="w-full py-3.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold tracking-wide text-sm transition-all cursor-pointer"
              >
                VOLTAR AO INÍCIO
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}

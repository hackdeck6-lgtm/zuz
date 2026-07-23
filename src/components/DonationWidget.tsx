import React, { useState, useEffect } from 'react';
import { Check, Heart, ArrowRight, Loader2, QrCode, Copy, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import QRCode from 'qrcode';
import { trackInitiateCheckout } from '../lib/fbpixel';

interface DonationWidgetProps {
  selectedDefaultAmount?: number | null;
}

export default function DonationWidget({ selectedDefaultAmount }: DonationWidgetProps) {
  // 1: Valor, 2: Dados do doador, 3: QR Code Pix + polling de confirmação
  const [step, setStep] = useState(1);
  const [amount, setAmount] = useState<number>(50);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isCustom, setIsCustom] = useState(false);

  // Form fields (supporter contact only — NO card/CVV/payment data is collected)
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [message, setMessage] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isAnonymous, setIsAnonymous] = useState(false);
  const [pixData, setPixData] = useState<{ transactionId: string; pixCode: string; qrImage: string | null } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<'PENDING' | 'OK' | 'ERROR'>('PENDING');
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // A PoseidonPay retorna o código Pix (copia-e-cola), mas não a imagem do QR.
  // Geramos o QR Code no browser a partir do próprio código.
  useEffect(() => {
    if (!pixData?.pixCode) {
      setQrDataUrl('');
      return;
    }
    QRCode.toDataURL(pixData.pixCode, { width: 220, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [pixData]);

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

  useEffect(() => {
    if (step !== 3 || !pixData || paymentStatus === 'OK') return;
    let attempts = 0;
    const maxAttempts = 225; // ~15 min a cada 4s
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(interval);
        return;
      }
      try {
        const r = await fetch(`/api/donations/${pixData.transactionId}/status`);
        const d = await r.json();
        if (d.status === 'OK') {
          setPaymentStatus('OK');
          clearInterval(interval);
        }
      } catch {
        /* ignora erros transitórios de polling */
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [step, pixData, paymentStatus]);

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
    if (amount < 3.01) {
      setErrorMsg('O valor mínimo para doação via Pix é R$ 3,01.');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const resp = await fetch('/api/pix/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, name, email, phone, document: cpf, message, isAnonymous }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErrorMsg(data?.error || 'Não foi possível gerar o Pix. Tente novamente.');
        setIsSubmitting(false);
        return;
      }
      setPixData({ transactionId: data.transactionId, pixCode: data.pixCode, qrImage: data.qrImage });
      // Dedup com o servidor: mesmo eventID do CAPI InitiateCheckout.
      if (data.eventId) trackInitiateCheckout(data.eventId, amount);
      setPaymentStatus('PENDING');
      setStep(3);
    } catch {
      setErrorMsg('Erro de conexão. Verifique sua internet e tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
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
          <QrCode size={14} /> Pix seguro
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
                Escolha quanto você quer doar agora via Pix:
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
                <QrCode size={16} className="text-amber-600 mt-0.5 shrink-0" />
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Ao continuar, geramos um <strong>Pix seguro</strong> para você concluir a doação no app do seu banco. Pedimos seu e-mail para enviar a confirmação.
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

              <label className="flex items-center gap-2 text-xs text-stone-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="rounded border-stone-300 text-terracotta-600 focus:ring-terracotta-500/30"
                />
                Doar anonimamente (seu nome não aparece no mural público)
              </label>

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
                <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">CPF (Opcional)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  className="w-full px-4 py-3.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-terracotta-500/20 focus:border-terracotta-500 text-sm font-medium"
                />
                <p className="text-[10px] text-stone-400">Opcional — usado apenas para emitir o Pix junto ao provedor de pagamento.</p>
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
                    <><Loader2 className="animate-spin" size={18} /> Gerando Pix...</>
                  ) : (
                    <>GERAR PIX <ArrowRight size={16} /></>
                  )}
                </button>
              </div>
              {errorMsg && <p className="text-xs text-red-600 text-center">{errorMsg}</p>}
            </motion.form>
          )}

          {/* Step 3: Real Pix — QR Code + copy-paste + status polling */}
          {step === 3 && pixData && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-5 py-2"
            >
              {paymentStatus === 'OK' ? (
                <>
                  <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 border-4 border-emerald-500/10 flex items-center justify-center text-emerald-600">
                    <Check size={32} strokeWidth={3} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-display text-xl font-bold text-stone-900">Pagamento recebido! 💛</h4>
                    <p className="text-stone-500 text-sm">
                      Obrigado, <strong className="text-stone-800">{isAnonymous ? 'apoiador(a)' : name}</strong>. Enviamos a confirmação para <strong>{email}</strong>.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1">
                    <h4 className="font-display text-lg font-bold text-stone-900">Escaneie para doar R$ {amount}</h4>
                    <p className="text-stone-500 text-xs">Abra o app do seu banco, escaneie o QR Code ou use o Pix copia e cola.</p>
                  </div>

                  {qrDataUrl || pixData.qrImage ? (
                    <img
                      src={qrDataUrl || pixData.qrImage || ''}
                      alt="QR Code do Pix"
                      className="w-48 h-48 mx-auto rounded-2xl border border-stone-200 bg-white p-2"
                    />
                  ) : (
                    <div className="w-48 h-48 mx-auto rounded-2xl border border-dashed border-stone-300 flex items-center justify-center text-stone-400">
                      <QrCode size={48} />
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-left">
                      <p className="text-[10px] uppercase font-bold text-stone-400 tracking-wider mb-1">Pix copia e cola</p>
                      <p className="text-[11px] text-stone-600 break-all font-mono leading-tight max-h-16 overflow-y-auto">
                        {pixData.pixCode}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(pixData.pixCode);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="w-full py-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      {copied ? <><Check size={16} /> Código copiado!</> : <><Copy size={16} /> Copiar código Pix</>}
                    </button>
                  </div>

                  <div className="flex items-center justify-center gap-2 text-xs text-stone-400">
                    <RefreshCw size={12} className="animate-spin" />
                    Aguardando confirmação do pagamento...
                  </div>
                </>
              )}

              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setAmount(50);
                  setName('');
                  setEmail('');
                  setPhone('');
                  setCpf('');
                  setMessage('');
                  setIsAnonymous(false);
                  setPixData(null);
                  setPaymentStatus('PENDING');
                }}
                className="w-full py-3 rounded-xl border border-stone-200 text-stone-500 font-bold text-sm hover:bg-stone-50 transition-all cursor-pointer"
              >
                {paymentStatus === 'OK' ? 'FAZER NOVA DOAÇÃO' : 'CANCELAR'}
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}

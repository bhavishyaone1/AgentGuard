import { useState, useEffect } from "react";
import { 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle2, 
  Loader2, 
  Terminal as TerminalIcon, 
  Wallet, 
  ExternalLink, 
  Copy, 
  RefreshCw, 
  Check, 
  Sliders,
  Sparkles,
  Server,
  Layers,
  ChevronDown,
  ArrowRight
} from "lucide-react";
import algosdk from "algosdk";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactAvmScheme } from "@x402/avm/exact/client";

// Constants
const USDC_ASA_ID = 10458941;
const ALGORAND_TESTNET_CAIP2 = "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=" as const;
const ALGOD_SERVER = "https://testnet-api.algonode.cloud";
const ALGOD_PORT = "";
const ALGOD_TOKEN = "";

const algodClient = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_SERVER, ALGOD_PORT);

// Presets
const DEMO_MERCHANTS = [
  { 
    name: "ALGOMetrics API", 
    tag: "Trusted Live Vendor", 
    desc: "Active market data API with 90+ verified settlements.",
    address: "api.algometrics.org",
    status: "trusted"
  },
  { 
    name: "Compx Amarok API", 
    tag: "Verified On-Chain", 
    desc: "Active Algorand merchant with 18,800+ on-chain verifications.",
    address: "XJCCGGJ6FL6CFYNXCTO6Q5YQ7E2OIYVRX2G3BVZUF4JOL36HSJRPLYHW5E",
    status: "trusted"
  },
  { 
    name: "Unknown Scammer Mock", 
    tag: "High-Risk Mock", 
    desc: "Fake address with 0 history. Tests firewall blocking.",
    address: "7Y4TGDJSHS5J4LHGKSLK5HJSKL44JLJDFSLDJKDFSD45FDGDFGDFGDG2",
    status: "high_risk"
  }
];

export default function App() {
  // Wallet State
  const [payerAddress, setPayerAddress] = useState<string>("");
  const [payerMnemonic, setPayerMnemonic] = useState<string>("");
  const [algoBalance, setAlgoBalance] = useState<number>(0);
  const [usdcBalance, setUsdcBalance] = useState<number>(0);
  const [isOptedIn, setIsOptedIn] = useState<boolean>(false);
  const [walletLoading, setWalletLoading] = useState<boolean>(false);
  const [copiedMnemonic, setCopiedMnemonic] = useState<boolean>(false);

  // Form State
  const [targetMerchant, setTargetMerchant] = useState<string>("api.algometrics.org");
  const [claimedPriceAmt, setClaimedPriceAmt] = useState<string>("10000"); // 0.01 USDC
  const [maxPerCall, setMaxPerCall] = useState<string>("50000"); // 0.05 USDC
  const [maxDailyRemaining, setMaxDailyRemaining] = useState<string>("200000"); // 0.20 USDC
  const serverUrl = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://localhost:8787"
    : "https://agentguard.bakshibhavi.workers.dev";

  // Log / Flow State
  const [logs, setLogs] = useState<Array<{ time: string; msg: string; type: "info" | "success" | "warn" | "error" | "tx" }>>([]);
  const [checking, setChecking] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(0); // 0: idle, 1: 402 chall, 2: signing, 3: settling, 4: resolved
  const [verdictData, setVerdictData] = useState<any>(null);

  const getStepHelperText = () => {
    switch (currentStep) {
      case 0: return "Ready to start. Choose a merchant preset in the sandbox below and click 'Execute Check' to launch the flow.";
      case 1: return "📡 Phase 1: Calling checking API. Server rejects with HTTP 402 Payment Required and returns payment requirements.";
      case 2: return "🔑 Phase 2: x402 fetch wrapper intercepts 402. Recovering Payer wallet secret key and signing the USDC transaction group...";
      case 3: return "⛓️ Phase 3: Submitting signed transaction group to Algorand Testnet. Waiting for block confirmation (~3.3s finality)...";
      case 4: return "🎉 Phase 4: Payment confirmed! Hono server queries GoPlausible registry, runs spend rules, and returns final verdict.";
      default: return "";
    }
  };

  // UI interaction states
  const [navbarShrunk, setNavbarShrunk] = useState<boolean>(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [codeTab, setCodeTab] = useState<"ts" | "py">("ts");
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  
  // Custom cursor position state
  const [mousePos, setMousePos] = useState({ x: -100, y: -100 });

  // Scroll tracking to shrink navbar
  useEffect(() => {
    const handleScroll = () => {
      setNavbarShrunk(window.scrollY > 30);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Custom pointer glow positioning
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("pointermove", handlePointerMove);
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, []);

  // Scroll reveal Intersection Observer (Staggered fade-in reveal)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("revealed");
          }
        });
      },
      { threshold: 0.05, rootMargin: "0px 0px -40px 0px" }
    );
    const elements = document.querySelectorAll(".reveal-section");
    elements.forEach((el) => observer.observe(el));
    return () => {
      elements.forEach((el) => observer.unobserve(el));
    };
  }, []);

  // Load wallet on mount
  useEffect(() => {
    const savedMnemonic = localStorage.getItem("agentguard_payer_mnemonic");
    if (savedMnemonic) {
      recoverWallet(savedMnemonic);
    } else {
      generateNewWallet();
    }
  }, []);

  const addLog = (msg: string, type: "info" | "success" | "warn" | "error" | "tx" = "info") => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { time, msg, type }]);
  };

  const generateNewWallet = () => {
    try {
      const account = algosdk.generateAccount();
      const mnemonic = algosdk.secretKeyToMnemonic(account.sk);
      localStorage.setItem("agentguard_payer_mnemonic", mnemonic);
      recoverWallet(mnemonic);
      addLog("Generated new dynamic test wallet.", "info");
    } catch (e: any) {
      addLog(`Failed to generate wallet: ${e.message}`, "error");
    }
  };

  const loadDemoWallet = () => {
    const DEMO_MNEMONIC = "sun sign term dash tube control method lumber elephant cause illegal arch pioneer soccer juice search isolate chimney thunder course liquid alarm element able catalog";
    recoverWallet(DEMO_MNEMONIC);
    addLog("Loaded funded testnet demo wallet (19.90 USDC, Opt-In Active).", "success");
  };

  const recoverWallet = async (mnemonic: string) => {
    setWalletLoading(true);
    try {
      const account = algosdk.mnemonicToSecretKey(mnemonic);
      setPayerAddress(account.addr);
      setPayerMnemonic(mnemonic);
      localStorage.setItem("agentguard_payer_mnemonic", mnemonic);
      await fetchBalances(account.addr);
    } catch (e: any) {
      addLog(`Error recovering wallet: ${e.message}`, "error");
    } finally {
      setWalletLoading(false);
    }
  };

  const fetchBalances = async (address: string) => {
    if (!address) return;
    try {
      const accountInfo = await algodClient.accountInformation(address).do();
      const rawAlgo = accountInfo.amount !== undefined ? accountInfo.amount : 0;
      const algo = Number(BigInt(rawAlgo)) / 1_000_000;
      setAlgoBalance(algo);
      
      let usdc = 0;
      let opted = false;
      const assets = (accountInfo as any).assets || [];
      for (const asset of assets) {
        const assetId = asset["asset-id"] !== undefined ? asset["asset-id"] : asset["assetId"];
        if (Number(assetId) === USDC_ASA_ID) {
          const amt = asset["amount"] !== undefined ? asset["amount"] : 0;
          usdc = Number(BigInt(amt)) / 1_000_000;
          opted = true;
          break;
        }
      }
      setUsdcBalance(usdc);
      setIsOptedIn(opted);
    } catch (err: any) {
      console.warn("fetchBalances warning:", err.message || err);
    }
  };

  const executeOptIn = async () => {
    if (!payerMnemonic) return;
    setWalletLoading(true);
    addLog(`Initiating USDC (ASA ${USDC_ASA_ID}) Opt-In...`, "info");
    try {
      const account = algosdk.mnemonicToSecretKey(payerMnemonic);
      const params = await algodClient.getTransactionParams().do();
      const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        from: account.addr,
        to: account.addr,
        assetIndex: USDC_ASA_ID,
        amount: 0,
        suggestedParams: params,
      });

      const signedTxn = txn.signTxn(account.sk);
      const { txId } = await algodClient.sendRawTransaction(signedTxn).do();
      addLog(`Opt-in tx submitted. Tx ID: ${txId}`, "tx");
      
      await algosdk.waitForConfirmation(algodClient, txId, 4);
      addLog("USDC Opt-in confirmed successfully!", "success");
      await fetchBalances(account.addr);
    } catch (e: any) {
      addLog(`USDC Opt-in failed: ${e.message || e}`, "error");
    } finally {
      setWalletLoading(false);
    }
  };

  const copyToClipboard = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Mouse Spotlight Movement Handler
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    card.style.setProperty("--mouse-x", `${x}px`);
    card.style.setProperty("--mouse-y", `${y}px`);
  };

  const handlePrePaymentCheck = async () => {
    if (checking) return;

    if (!isOptedIn || usdcBalance < 0.01) {
      setLogs([]);
      addLog("⚠️ Insufficient Testnet Balance or Missing USDC Opt-In.", "warn");
      addLog(`Current balance: ${usdcBalance.toFixed(2)} USDC (Requires $0.01 USDC check fee).`, "error");
      addLog("💡 Tip: Click 'Load Funded Demo Wallet' on the left to test instantly with 19.90 USDC!", "info");
      return;
    }

    setChecking(true);
    setVerdictData(null);
    setLogs([]);
    setCurrentStep(1);

    addLog("🤖 AI Agent initiating pre-payment trust validation...", "info");
    addLog(`Target Endpoint/Address: ${targetMerchant}`, "info");
    addLog(`Claimed Price: ${(Number(claimedPriceAmt) / 1000000).toFixed(6)} USDC (${claimedPriceAmt} base)`, "info");

    try {
      const account = algosdk.mnemonicToSecretKey(payerMnemonic);
      
      const clientSigner = {
        address: account.addr,
        signTransactions: async (txns: Uint8Array[], indexesToSign?: number[]): Promise<(Uint8Array | null)[]> => {
          addLog("🔑 SDK requested payment signatures. Signing AVM transaction group...", "info");
          setCurrentStep(2);
          const signed = txns.map((txnBytes, i) => {
            if (indexesToSign && !indexesToSign.includes(i)) return null;
            const txn = algosdk.decodeUnsignedTransaction(txnBytes);
            return txn.signTxn(account.sk);
          });
          addLog("✅ Transaction group signed.", "success");
          return signed;
        }
      };

      const config = {
        schemes: [
          {
            network: ALGORAND_TESTNET_CAIP2,
            client: new ExactAvmScheme(clientSigner),
          },
        ],
      };

      const customFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        addLog(`POST ${serverUrl}/api/check (Initial unpaid call)`, "info");
        const res = await fetch(input, init);
        
        if (res.status === 402) {
          addLog("📥 Received HTTP 402 Payment Required", "warn");
          addLog("Parsing PAYMENT-REQUIRED headers...", "info");
          setCurrentStep(3);
          addLog("Submitting payment for settlement via GoPlausible testnet facilitator...", "info");
        }
        return res;
      };

      const fetchWithPay = wrapFetchWithPaymentFromConfig(customFetch, config);

      const response = await fetchWithPay(`${serverUrl}/api/check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          merchantAddress: targetMerchant,
          claimedPrice: { amount: claimedPriceAmt, asset: "USDC" },
          callerSpendPolicy: { maxPerCall, maxDailyRemaining }
        })
      });

      setCurrentStep(4);
      addLog(`Response Status: ${response.status} ${response.statusText}`, response.ok ? "success" : "error");

      const data = await response.json();
      setVerdictData(data);
      
      if (response.ok) {
        addLog("🎉 AgentGuard validation complete!", "success");
        addLog(`Settlement Transaction: ${data.settlement?.txId || "None"}`, "tx");
      } else {
        addLog(`Server responded with error: ${data.error || JSON.stringify(data)}`, "error");
      }

    } catch (e: any) {
      addLog(`Execution failed: ${e.message || e}`, "error");
      setCurrentStep(0);
    } finally {
      setChecking(false);
      fetchBalances(payerAddress);
    }
  };

  const faqs = [
    { q: "What is the x402 Protocol?", a: "The x402 Protocol is a decentralized standard that enables machine-to-machine micropayments. It triggers an HTTP 402 Payment Required status code, requesting the client agent to pay-per-call on-chain before receiving resource outputs." },
    { q: "How does the Pre-Payment Trust check work?", a: "Before the agent signs and transfers USDC, AgentGuard intercepts the call, queries the GoPlausible Bazaar discover registries, audits the merchant credentials, verifies transaction history, and compares it against caller spend policies." },
    { q: "Who sponsors the transaction fees?", a: "AgentGuard uses Algorand's atomic transaction groups to structure a gasless transfer. The GoPlausible facilitator sponsors the native ALGO network fees, meaning paying agents only require USDC." },
    { q: "How do I integrate this in my AI agent script?", a: "You simply wrap the native fetch client using the @x402/fetch SDK wrapper and pass your AVM signer. The SDK handles 402 challenge intercepts and key signatures automatically." }
  ];

  return (
    <div className="min-h-screen text-text-primary flex flex-col relative overflow-hidden bg-bg-navy selection:bg-brand-violet selection:text-white">
      
      {/* Background Aurora & Grid Pattern */}
      <div className="aurora-bg"></div>
      <div className="grid-overlay"></div>

      {/* Floating Lights Decoration */}
      <div className="absolute top-[15%] left-[5%] w-[400px] h-[400px] bg-brand-violet/5 rounded-full blur-[100px] pointer-events-none aurora-blob-1"></div>
      <div className="absolute top-[45%] right-[10%] w-[350px] h-[350px] bg-brand-blue/5 rounded-full blur-[120px] pointer-events-none aurora-blob-2"></div>
      <div className="absolute bottom-[10%] left-[20%] w-[450px] h-[450px] bg-brand-magenta/4 rounded-full blur-[140px] pointer-events-none"></div>

      {/* Ambient Custom Cursor Glow */}
      <div 
        className="hidden lg:block custom-cursor-glow" 
        style={{ left: `${mousePos.x}px`, top: `${mousePos.y}px` }}
      ></div>

      {/* Floating Glass Navbar */}
      <header className={`fixed top-4 left-1/2 -translate-x-1/2 w-[92%] max-w-5xl rounded-full z-50 transition-all duration-300 ${
        navbarShrunk 
          ? "bg-bg-navy-light/75 border-white/10 shadow-2xl py-3 px-6 backdrop-blur-lg" 
          : "bg-transparent border-transparent py-5 px-8"
      } border flex justify-between items-center`}>
        <div className="flex items-center gap-3">
          <span className="font-extrabold text-sm tracking-tight font-display text-white">AgentGuard</span>
        </div>

        <nav className="hidden md:flex items-center gap-1.5">
          {["Platform", "Solution", "Sandbox", "Features", "Architecture", "FAQ"].map((sect) => (
            <a 
              key={sect}
              href={`#${sect.toLowerCase()}`}
              className="text-xs font-semibold text-text-secondary hover:text-white px-3.5 py-1.5 rounded-full transition-all hover:bg-white/5"
            >
              {sect}
            </a>
          ))}
        </nav>

        <div>
          <a 
            href="#sandbox"
            className="text-[10px] font-extrabold bg-white hover:bg-white/95 text-bg-navy-dark px-4 py-2 rounded-full transition-all uppercase tracking-wider shadow-md shadow-white/5 font-display"
          >
            Launch Console
          </a>
        </div>
      </header>

      {/* 1. Hero Section */}
      <section id="platform" className="reveal-section w-full max-w-7xl mx-auto px-6 pt-32 pb-20 md:pt-40 md:pb-28 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
        
        {/* Left Column Text */}
        <div className="lg:col-span-7 flex flex-col gap-6 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 bg-brand-violet/8 border border-brand-violet/15 px-3 py-1 rounded-full w-fit mx-auto lg:mx-0 shadow-lg shadow-brand-violet/5">
            <Sparkles className="w-3.5 h-3.5 text-brand-violet" />
            <span className="text-[10px] font-extrabold text-brand-violet uppercase tracking-widest font-display">Algorand Autonomous Gateway</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-black tracking-tight text-white leading-[1.05] font-display">
            The Trust Layer <br />
            for <span className="bg-gradient-to-r from-brand-violet via-brand-cyan to-brand-emerald bg-clip-text text-transparent">AI Commerce</span>
          </h1>

          <p className="text-text-secondary text-base md:text-lg leading-relaxed max-w-xl mx-auto lg:mx-0">
            Secure machine micropayments. AgentGuard acts as a pre-payment spend policy firewall and endpoint registry check before your AI wallets spend on-chain.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start items-center mt-2">
            <a 
              href="#sandbox" 
              className="w-full sm:w-auto text-xs font-extrabold bg-gradient-to-r from-brand-violet via-brand-blue to-brand-cyan text-white px-7 py-4 rounded-full glow-btn-primary uppercase tracking-wider font-display text-center"
            >
              Enter Sandbox →
            </a>
            <a 
              href="#solution" 
              className="w-full sm:w-auto text-xs font-extrabold border border-white/10 hover:border-white/18 text-text-primary px-7 py-4 rounded-full transition-all uppercase tracking-wider bg-white/3 text-center"
            >
              Read Protocol Flow
            </a>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-6 max-w-md mx-auto lg:mx-0 mt-8 border-t border-white/5 pt-8 text-left">
            <div>
              <span className="block text-3xl font-black text-white font-display">~3s</span>
              <span className="text-[9px] uppercase tracking-wider text-text-secondary font-bold font-display">Block Finality</span>
            </div>
            <div>
              <span className="block text-3xl font-black text-brand-blue font-display">$0.01</span>
              <span className="text-[9px] uppercase tracking-wider text-text-secondary font-bold font-display">Micropayment</span>
            </div>
            <div>
              <span className="block text-3xl font-black text-brand-emerald font-display">Gasless</span>
              <span className="text-[9px] uppercase tracking-wider text-text-secondary font-bold font-display">Fee Abstraction</span>
            </div>
          </div>
        </div>

        {/* Right Column: Rotating Orbit Net */}
        <div className="lg:col-span-5 flex justify-center items-center relative py-8">
          <div className="relative w-[340px] h-[340px] flex items-center justify-center orb-container">
            
            {/* Mesh rings */}
            <div className="absolute inset-0 border border-dashed border-white/10 rounded-full orb-ring-slow"></div>
            <div className="absolute inset-[40px] border border-dashed border-brand-violet/20 rounded-full rotate-45"></div>
            <div className="absolute inset-[80px] border-2 border-brand-blue/15 border-t-brand-blue border-r-brand-violet rounded-full orb-ring-fast"></div>

            {/* Visual Node Links */}
            <div className="absolute top-[-5px] left-[32%] glass-panel py-1 px-3 rounded-full border border-white/10 flex items-center gap-1.5 shadow-2xl">
              <Server className="w-3 h-3 text-brand-blue" />
              <span className="text-[9px] font-bold text-white tracking-tight uppercase">Registry API</span>
            </div>
            <div className="absolute bottom-[20px] left-[-10px] glass-panel py-1 px-3 rounded-full border border-white/10 flex items-center gap-1.5 shadow-2xl">
              <Sliders className="w-3 h-3 text-brand-violet" />
              <span className="text-[9px] font-bold text-white tracking-tight uppercase">Policy Gate</span>
            </div>
            <div className="absolute right-[-15px] top-[40%] glass-panel py-1 px-3 rounded-full border border-white/10 flex items-center gap-1.5 shadow-2xl">
              <Wallet className="w-3 h-3 text-brand-emerald" />
              <span className="text-[9px] font-bold text-white tracking-tight uppercase">Vault (USDC)</span>
            </div>

            {/* Glowing Center Core Sphere */}
            <div className="w-[100px] h-[100px] rounded-full bg-gradient-to-tr from-brand-violet via-brand-blue to-brand-emerald flex items-center justify-center p-[2px] shadow-[0_0_60px_rgba(139,92,246,0.35)] orb-core-pulse">
              <div className="w-full h-full rounded-full bg-[#07070B] flex items-center justify-center">
                {checking ? (
                  <Loader2 className="w-9 h-9 text-brand-violet animate-spin" />
                ) : currentStep === 4 && verdictData?.trust?.verdict === "trusted" ? (
                  <ShieldCheck className="w-11 h-11 text-brand-emerald drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                ) : currentStep === 4 && verdictData?.trust?.verdict === "high_risk" ? (
                  <ShieldAlert className="w-11 h-11 text-brand-rose drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                ) : (
                  <ShieldCheck className="w-9 h-9 text-brand-blue opacity-80" />
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Problem & Solution Section */}
      <section id="solution" className="reveal-section w-full max-w-7xl mx-auto px-6 py-20 relative z-10 border-t border-white/5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          {/* Left panel: Problem definition */}
          <div className="flex flex-col gap-6">
            <span className="text-[10px] font-bold text-brand-rose uppercase tracking-widest font-display">The Spend Vulnerability</span>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white leading-tight font-display">
              AI Agents currently pay <br />
              anyone blindly.
            </h2>
            <p className="text-text-secondary text-sm leading-relaxed max-w-md">
              Autonomous agents execute transactions via script-based instructions. Without a middleman firewall, agents cannot evaluate merchant reputation or policy matching before signing a payment, exposing vaults to drainage loops and rug-pulls.
            </p>
            
            {/* Visual Risk mockup */}
            <div className="bg-bg-navy-dark/40 border border-brand-rose/15 p-4.5 rounded-xl flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-brand-rose font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Unshielded Call
                </span>
                <span className="text-[9px] font-mono text-text-faint">Direct Wallet-to-API</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono border-t border-white/5 pt-2.5 text-text-secondary">
                <div>Price Claimed: <span className="text-white">5.00 USDC</span></div>
                <div>Registry Status: <span className="text-brand-rose font-bold">UNREGISTERED</span></div>
                <div className="col-span-2 text-brand-rose font-bold mt-0.5">⚠️ Status: Exposed (Wallet Drained)</div>
              </div>
            </div>
          </div>

          {/* Right panel: Solution definition */}
          <div className="flex flex-col gap-6">
            <span className="text-[10px] font-bold text-brand-emerald uppercase tracking-widest font-display">The Security Shield</span>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white leading-tight font-display">
              Pre-Payment Trust <br />
              Firewall.
            </h2>
            <p className="text-text-secondary text-sm leading-relaxed max-w-md">
              AgentGuard sits as a proxy barrier. The agent sends the call, and for $0.01 USDC, AgentGuard performs a structural audit of the receiver's discovery registry details and filters it against your spend policies *before* signing occurs.
            </p>

            {/* Visual Shield mockup */}
            <div className="bg-bg-navy-dark/40 border border-brand-emerald/15 p-4.5 rounded-xl flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-brand-emerald font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  AgentGuard Gate
                </span>
                <span className="text-[9px] font-mono text-text-faint">Audited Proxy Firewall</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono border-t border-white/5 pt-2.5 text-text-secondary">
                <div>Price Claimed: <span className="text-white">0.01 USDC</span></div>
                <div>Registry Status: <span className="text-brand-emerald font-bold">VERIFIED SAFE</span></div>
                <div className="col-span-2 text-brand-emerald font-bold mt-0.5">✅ Status: Blocked/Approved by Rules</div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 3. Interactive Architecture Flow */}
      <section id="architecture" className="reveal-section w-full max-w-7xl mx-auto px-6 py-20 relative z-10 border-t border-white/5">
        <div className="text-center mb-12">
          <span className="text-[10px] font-bold text-brand-violet uppercase tracking-widest font-display">System Integrity</span>
          <h2 className="text-3xl md:text-4xl font-black text-white font-display mt-2">Interactive Protocol Architecture</h2>
          <p className="text-text-secondary text-sm mt-3 max-w-lg mx-auto">
            Trace the live verification pipeline from the payer's wallet to the facilitator registry and Algorand settlement.
          </p>
        </div>

        {/* Visual pipeline */}
        <div className="premium-card rounded-3xl p-8 overflow-x-auto">
          <div className="min-w-[850px] flex items-center justify-between relative py-6">
            
            {/* Visual connector lines */}
            <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-white/5 -translate-y-1/2 z-0"></div>
            <div className={`absolute top-1/2 left-0 h-[2px] bg-gradient-to-r from-brand-violet via-brand-blue to-brand-emerald -translate-y-1/2 z-0 transition-all duration-1000 ${
              currentStep === 0 ? 'w-0' :
              currentStep === 1 ? 'w-1/4' :
              currentStep === 2 ? 'w-2/4' :
              currentStep === 3 ? 'w-3/4' : 'w-full'
            }`}></div>
            
            {/* Steps */}
            {[
              { label: "Payer Wallet", desc: "USDC & Mnemonic setup", activeStep: 0, icon: Wallet },
              { label: "402 Challenge", desc: "API returns Payment Required", activeStep: 1, icon: AlertTriangle },
              { label: "AVM Sign", desc: "USDC Transaction group signature", activeStep: 2, icon: Sliders },
              { label: "On-Chain Settle", desc: "Algorand Testnet transfer", activeStep: 3, icon: Layers },
              { label: "Final Release", desc: "Verdict & 200 OK Response", activeStep: 4, icon: ShieldCheck }
            ].map((node, index) => {
              const IconComp = node.icon;
              const isPassed = currentStep >= node.activeStep;
              const isActive = currentStep === node.activeStep;

              return (
                <div key={index} className="flex flex-col items-center gap-3.5 z-10 relative bg-[#0D0D0D] px-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all duration-500 shadow-xl ${
                    isActive ? 'bg-brand-violet/20 border-brand-violet scale-110 shadow-brand-violet/10' :
                    isPassed ? 'bg-brand-emerald/10 border-brand-emerald text-brand-emerald' :
                    'bg-bg-navy-dark border-white/5 text-text-faint'
                  }`}>
                    <IconComp className="w-6 h-6" />
                  </div>
                  <div className="text-center flex flex-col gap-1 max-w-[150px]">
                    <span className={`text-xs font-bold transition-colors ${isPassed ? 'text-white' : 'text-text-faint'}`}>{node.label}</span>
                    <span className="text-[9px] text-text-secondary leading-normal">{node.desc}</span>
                  </div>
                </div>
              );
            })}

          </div>
          
          {/* Dynamic step explanations */}
          <div className="mt-6 bg-white/[0.02] border border-white/5 p-4.5 rounded-2xl flex items-center justify-center text-center">
            <p className="text-xs font-mono text-brand-violet font-semibold transition-all duration-300">{getStepHelperText()}</p>
          </div>
        </div>
      </section>

      {/* 4. Interactive Sandbox Sandbox (Live Sandbox Demo) */}
      <section id="sandbox" className="reveal-section w-full max-w-7xl mx-auto px-6 py-20 relative z-10 border-t border-white/5">
        
        <div className="text-center mb-14">
          <span className="text-[10px] font-bold text-brand-cyan uppercase tracking-widest font-display">Interactive Playground</span>
          <h2 className="text-3xl md:text-4xl font-black text-white font-display mt-2">Live Verification Sandbox</h2>
          <p className="text-text-secondary text-sm mt-3 max-w-lg mx-auto">
            Review the wallet setup, configure the policy threshold gates, and execute a paid pre-payment audit on the testnet.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left panel config column (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            
            {/* Wallet Panel */}
            <div className="premium-card rounded-2xl p-6 flex flex-col gap-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-brand-emerald/5 rounded-full blur-2xl pointer-events-none"></div>

              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-brand-emerald" />
                  Payer Wallet
                </h3>
                <button 
                  onClick={() => fetchBalances(payerAddress)}
                  disabled={walletLoading}
                  className="p-1.5 text-text-secondary hover:text-white rounded-lg hover:bg-white/5 transition-all"
                  title="Refresh Balance"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${walletLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Developer UX Faucet Guide */}
              <p className="text-[11px] text-text-secondary leading-normal bg-white/[0.01] border border-white/5 p-3 rounded-xl">
                💡 <b>Getting Started:</b> Copy the address below, open the <a href="https://bank.testnet.algorand.network/" target="_blank" rel="noreferrer" className="text-brand-blue hover:underline font-bold">Algorand Dispenser</a>, and fund it with both <b>ALGO</b> and <b>USDC</b> (via the USDC option at the bottom).
              </p>

              {/* Address display */}
              <div className="bg-bg-navy-dark border border-white/5 p-4 rounded-xl flex flex-col gap-1.5">
                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Address</span>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono truncate text-white max-w-[280px]">
                    {payerAddress || "Generating..."}
                  </span>
                  <button 
                    onClick={() => copyToClipboard(payerAddress, setCopiedMnemonic)}
                    className="p-1 text-text-secondary hover:text-white rounded transition-colors"
                  >
                    {copiedMnemonic ? <Check className="w-3.5 h-3.5 text-brand-emerald" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Balances Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-bg-navy-dark border border-white/5 p-3.5 rounded-xl text-center">
                  <span className="text-[9px] font-bold text-text-secondary uppercase tracking-wider block">ALGO Balance</span>
                  <span className="text-lg font-black text-white mt-1 block font-mono">{algoBalance.toFixed(3)}</span>
                </div>
                <div className="bg-bg-navy-dark border border-white/5 p-3.5 rounded-xl text-center relative overflow-hidden">
                  <span className="text-[9px] font-bold text-text-secondary uppercase tracking-wider block">USDC Balance</span>
                  <span className="text-lg font-black text-brand-blue mt-1 block font-mono">{usdcBalance.toFixed(2)}</span>
                </div>
              </div>

              {/* USDC Opt-in Status */}
              <div className="flex flex-col gap-2.5">
                {!isOptedIn ? (
                  <div className="bg-brand-rose/5 border border-brand-rose/15 p-3.5 rounded-xl flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-brand-rose shrink-0 mt-0.5" />
                    <div className="flex flex-col gap-1">
                      <p className="text-xs font-bold text-brand-rose">USDC Opt-In Needed</p>
                      <p className="text-[10px] text-text-secondary leading-normal">
                        Algorand accounts must opt into the USDC ASA before receiving it.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-brand-emerald/8 border border-brand-emerald/15 p-3 rounded-xl flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-brand-emerald" />
                    <span className="text-[10px] font-bold text-brand-emerald uppercase tracking-wider">USDC Opt-In Active</span>
                  </div>
                )}

                <button 
                  onClick={loadDemoWallet}
                  disabled={walletLoading}
                  className="w-full text-xs font-bold py-2 rounded-xl bg-brand-emerald/15 text-brand-emerald border border-brand-emerald/30 hover:bg-brand-emerald/25 transition-all uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-brand-emerald/5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Load Funded Demo Wallet (19.90 USDC)
                </button>

                <div className="flex gap-2">
                  <button 
                    onClick={executeOptIn}
                    disabled={walletLoading || isOptedIn}
                    className="flex-1 text-xs font-bold py-2.5 rounded-xl bg-brand-blue hover:bg-brand-blue/90 disabled:opacity-50 transition-colors uppercase tracking-wider"
                  >
                    Opt-in to USDC
                  </button>
                  <button 
                    onClick={generateNewWallet}
                    disabled={walletLoading}
                    className="text-xs font-bold py-2.5 px-4 rounded-xl border border-white/10 hover:bg-white/5 transition-colors uppercase tracking-wider"
                  >
                    Generate
                  </button>
                </div>
              </div>

              {/* Mnemonic Copy */}
              <div className="border-t border-white/5 pt-3.5 flex justify-between items-center text-xs">
                <span className="font-semibold text-text-secondary">Secret Mnemonic</span>
                <button 
                  onClick={() => copyToClipboard(payerMnemonic, setCopiedMnemonic)}
                  className="text-[10px] font-bold text-brand-violet hover:underline flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedMnemonic ? (
                    <>
                      <Check className="w-3 h-3 text-brand-emerald" />
                      Copied Secret Words
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      Copy Mnemonic
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Policy Panel */}
            <div className="premium-card rounded-2xl p-6 flex flex-col gap-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-brand-violet/5 rounded-full blur-2xl pointer-events-none"></div>

              <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest flex items-center gap-2">
                <Sliders className="w-4 h-4 text-brand-violet" />
                Spend Policy Rules
              </h3>

              {/* Max per call */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-white">Max Per Call</span>
                  <span className="font-mono text-brand-violet font-semibold">{(Number(maxPerCall) / 1000000).toFixed(4)} USDC</span>
                </div>
                <input 
                  type="range" 
                  min="1000" 
                  max="100000" 
                  step="1000" 
                  value={maxPerCall}
                  onChange={(e) => setMaxPerCall(e.target.value)}
                  className="w-full accent-brand-violet bg-white/10 h-1 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-[10px] text-text-secondary leading-normal">
                  Fails checks automatically if claimed price exceeds this threshold.
                </span>
              </div>

              {/* Daily remaining */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-white">Daily remaining Limit</span>
                  <span className="font-mono text-brand-violet font-semibold">{(Number(maxDailyRemaining) / 1000000).toFixed(2)} USDC</span>
                </div>
                <input 
                  type="range" 
                  min="10000" 
                  max="500000" 
                  step="10000" 
                  value={maxDailyRemaining}
                  onChange={(e) => setMaxDailyRemaining(e.target.value)}
                  className="w-full accent-brand-violet bg-white/10 h-1 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-[10px] text-text-secondary leading-normal">
                  Fails check when the remaining aggregated daily budget is crossed.
                </span>
              </div>
            </div>

          </div>

          {/* Right Column: Console sandbox and targets (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* Target Settings Card */}
            <div className="premium-card rounded-2xl p-6 flex flex-col gap-5">
              <div className="flex flex-col gap-1">
                <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-brand-blue" />
                  Target Merchant Query
                </h3>
                <p className="text-[10px] text-text-secondary leading-normal mt-1">
                  In autonomous AI commerce, a <b>Merchant</b> is any paid API, data provider, or cloud service your AI agent wants to buy from. Select a preset below to test:
                </p>
              </div>

              {/* Merchant presets grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {DEMO_MERCHANTS.map((m) => (
                  <button 
                    key={m.name}
                    onClick={() => {
                      setTargetMerchant(m.address);
                      if (m.status === "trusted") {
                        setClaimedPriceAmt("10000"); // 0.01 USDC
                      } else {
                        setClaimedPriceAmt("15000"); // 0.015 USDC
                      }
                    }}
                    className={`p-3.5 text-left rounded-xl border transition-all text-xs flex flex-col gap-2 cursor-pointer ${
                      targetMerchant === m.address 
                        ? 'bg-brand-blue/8 border-brand-blue shadow-lg shadow-brand-blue/5' 
                        : 'bg-bg-navy-dark border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-white leading-normal truncate">{m.name}</span>
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded font-mono uppercase shrink-0 ${
                        m.status === "trusted" ? 'bg-brand-emerald/15 text-brand-emerald' :
                        m.status === "verified" ? 'bg-brand-blue/15 text-brand-blue' :
                        'bg-brand-rose/15 text-brand-rose'
                      }`}>{m.tag}</span>
                    </div>
                    <p className="text-[9.5px] text-text-secondary leading-relaxed line-clamp-2">{m.desc}</p>
                    <span className="text-[8.5px] font-mono text-text-faint truncate mt-auto border-t border-white/5 pt-1.5">{m.address}</span>
                  </button>
                ))}
              </div>

              {/* Input targets */}
              <div className="flex flex-col md:flex-row gap-4 items-center">
                <div className="w-full flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Merchant Host or Wallet</label>
                  <input 
                    type="text" 
                    value={targetMerchant}
                    onChange={(e) => setTargetMerchant(e.target.value)}
                    placeholder="Enter merchant address or api host name"
                    className="bg-bg-navy-dark border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-brand-blue font-mono"
                  />
                </div>
                <div className="w-full md:w-56 flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Claimed Price (USDC Base)</label>
                  <input 
                    type="text" 
                    value={claimedPriceAmt}
                    onChange={(e) => setClaimedPriceAmt(e.target.value)}
                    placeholder="Claimed amount"
                    className="bg-bg-navy-dark border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-brand-blue font-mono"
                  />
                </div>
              </div>


              <button 
                onClick={handlePrePaymentCheck}
                disabled={checking || !payerAddress || walletLoading}
                className="w-full font-extrabold bg-gradient-to-r from-brand-violet to-brand-blue hover:scale-[1.01] transition-transform text-white py-3.5 rounded-xl flex items-center justify-center gap-2.5 glow-btn-primary disabled:opacity-50 disabled:pointer-events-none uppercase tracking-wider text-xs"
              >
                {checking ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Executing Paid Validation...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4.5 h-4.5" />
                    🛡️ Execute Pre-payment Check ($0.01 USDC Fee)
                  </>
                )}
              </button>
            </div>

            {/* Live Terminal Logger */}
            <div className="premium-card rounded-2xl p-6 flex flex-col gap-4 relative overflow-hidden">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest flex items-center gap-2">
                  <TerminalIcon className="w-4 h-4 text-brand-violet" />
                  Live Agent Terminal Log
                </h3>
                <span className="text-[9px] font-bold text-text-secondary uppercase tracking-wider bg-white/5 border border-white/5 py-1 px-2.5 rounded-full">
                  Interactive Sandbox
                </span>
              </div>

              <div className="w-full h-52 bg-bg-navy-dark border border-white/10 rounded-xl p-4 font-mono text-[11px] overflow-y-auto flex flex-col gap-2 shadow-inner">
                {logs.length === 0 ? (
                  <span className="text-text-faint italic">Agent is idle. Press "Execute Check" to record activities...</span>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="flex items-start gap-2 leading-relaxed animate-fade-in">
                      <span className="text-text-faint shrink-0">[{log.time}]</span>
                      <span className={
                        log.type === "success" ? "text-brand-emerald" :
                        log.type === "warn" ? "text-brand-amber" :
                        log.type === "error" ? "text-brand-rose font-bold" :
                        log.type === "tx" ? "text-brand-blue font-bold" :
                        "text-text-secondary"
                      }>
                        {log.msg}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Verdict Display Section */}
            {verdictData && (
              <div className={`premium-card rounded-2xl p-6 border-l-4 transition-all duration-300 relative overflow-hidden flex flex-col gap-5 ${
                verdictData.trust?.verdict === "trusted" ? 'border-l-brand-emerald' : 'border-l-brand-rose'
              }`}>
                {/* Background glow highlights */}
                <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-10 pointer-events-none ${
                  verdictData.trust?.verdict === "trusted" ? 'bg-brand-emerald' : 'bg-brand-rose'
                }`}></div>

                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      verdictData.trust?.verdict === "trusted" ? 'bg-brand-emerald/10' : 'bg-brand-rose/10'
                    }`}>
                      {verdictData.trust?.verdict === "trusted" ? (
                        <ShieldCheck className="w-6 h-6 text-brand-emerald" />
                      ) : (
                        <ShieldAlert className="w-6 h-6 text-brand-rose" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white uppercase tracking-wider font-display">
                        Validation Verdict: {verdictData.trust?.verdict === "trusted" ? 'Trusted Merchant' : 'High Risk'}
                      </h4>
                      <p className="text-xs text-text-secondary mt-1">
                        GoPlausible Discovery score & spend policy resolution
                      </p>
                    </div>
                  </div>

                  <span className={`text-xs font-black px-3.5 py-1.5 rounded-lg font-mono ${
                    verdictData.trust?.verdict === "trusted" ? 'bg-brand-emerald/15 text-brand-emerald' : 'bg-brand-rose/15 text-brand-rose'
                  }`}>
                    {verdictData.trust?.verdict === "trusted" ? 'PASS' : 'RISK'}
                  </span>
                </div>

                {/* Mini-badges bar */}
                {verdictData.trust?.reputationScore !== undefined && (
                  <div className="flex flex-wrap gap-2.5 border-t border-b border-white/5 py-3">
                    <div className="bg-white/3 border border-white/5 px-2.5 py-1 rounded-lg text-[10px] flex items-center gap-1.5">
                      <span className="text-text-secondary font-medium">Reputation:</span>
                      <span className={`font-mono font-bold ${
                        verdictData.trust.reputationScore >= 80 ? 'text-brand-emerald' :
                        verdictData.trust.reputationScore >= 50 ? 'text-brand-amber' : 'text-brand-rose'
                      }`}>{verdictData.trust.reputationScore}/100</span>
                    </div>

                    <div className="bg-white/3 border border-white/5 px-2.5 py-1 rounded-lg text-[10px] flex items-center gap-1.5">
                      <span className="text-text-secondary font-medium">Risk Level:</span>
                      <span className={`font-mono font-bold uppercase ${
                        verdictData.trust.riskLevel === 'low' ? 'text-brand-emerald' :
                        verdictData.trust.riskLevel === 'medium' ? 'text-brand-amber' : 'text-brand-rose'
                      }`}>{verdictData.trust.riskLevel}</span>
                    </div>

                    <div className="bg-white/3 border border-white/5 px-2.5 py-1 rounded-lg text-[10px] flex items-center gap-1.5">
                      <span className="text-text-secondary font-medium">Recommendation:</span>
                      <span className={`font-mono font-bold uppercase ${
                        verdictData.trust.recommendation === 'proceed' ? 'text-brand-emerald' :
                        verdictData.trust.recommendation === 'proceed_with_caution' ? 'text-brand-amber' : 'text-brand-rose'
                      }`}>{verdictData.trust.recommendation.replace(/_/g, ' ')}</span>
                    </div>
                  </div>
                )}

                {/* Animated Reputation Trust Gauge */}
                {verdictData.trust?.reputationScore !== undefined && (
                  <div className="flex flex-col gap-2 bg-bg-navy-dark border border-white/5 p-4 rounded-xl">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-brand-emerald" />
                        Reputation Trust Gauge
                      </span>
                      <span className="font-mono font-bold text-brand-emerald">
                        {verdictData.trust.reputationScore} / 100
                      </span>
                    </div>
                    <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ${
                          verdictData.trust.reputationScore >= 80 ? 'bg-gradient-to-r from-brand-emerald to-brand-blue' :
                          verdictData.trust.reputationScore >= 50 ? 'bg-gradient-to-r from-brand-amber to-brand-rose' :
                          'bg-brand-rose'
                        }`}
                        style={{ width: `${verdictData.trust.reputationScore}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Plain English Verdict Explanation Banner */}
                {verdictData.trust?.verdict === "trusted" ? (
                  <div className="bg-brand-emerald/8 border border-brand-emerald/15 p-3.5 rounded-xl flex items-start gap-2.5">
                    <ShieldCheck className="w-4.5 h-4.5 text-brand-emerald shrink-0 mt-0.5" />
                    <p className="text-[11px] text-text-primary leading-normal">
                      🛡️ <b>Safe to Pay:</b> This merchant endpoint is registered and active on the GoPlausible Bazaar index. All local spend policies passed. AgentGuard recommends permitting the transaction.
                    </p>
                  </div>
                ) : (
                  <div className="bg-brand-rose/8 border border-brand-rose/15 p-3.5 rounded-xl flex items-start gap-2.5">
                    <AlertTriangle className="w-4.5 h-4.5 text-brand-rose shrink-0 mt-0.5" />
                    <p className="text-[11px] text-text-primary leading-normal">
                      ⚠️ <b>Blocked / High Risk:</b> The target is unregistered, has zero transaction history, or has violated your spend policy limits. AgentGuard has blocked this payment from signing.
                    </p>
                  </div>
                )}

                {/* Verdict Info / Reasons Grid */}
                <div className="bg-bg-navy-dark border border-white/5 rounded-xl p-4 flex flex-col gap-3">
                  <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block">Registry Verification Logic</span>
                  <div className="flex flex-col gap-2.5">
                    {verdictData.trust?.reasons?.map((reason: string, idx: number) => (
                      <div key={idx} className="flex items-start gap-2.5 text-xs text-text-primary leading-normal">
                        <ArrowRight className="w-3.5 h-3.5 text-brand-violet shrink-0 mt-0.5" />
                        <span>{reason}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Spend policy check and receipt */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-bg-navy-dark border border-white/5 p-4 rounded-xl flex flex-col gap-1.5">
                    <span className="text-[9px] font-bold text-text-secondary uppercase tracking-wider block">Local Spend Policy Decision</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        verdictData.spendPolicy?.decision === "allow" ? 'bg-brand-emerald/10 text-brand-emerald' : 'bg-brand-rose/10 text-brand-rose'
                      }`}>
                        {verdictData.spendPolicy?.decision}
                      </span>
                      <span className="text-xs text-text-secondary font-medium leading-normal">
                        {verdictData.spendPolicy?.reason}
                      </span>
                    </div>
                  </div>

                  <div className="bg-bg-navy-dark border border-white/5 p-4 rounded-xl flex flex-col gap-1.5 justify-center">
                    <span className="text-[9px] font-bold text-text-secondary uppercase tracking-wider block">AVM Testnet Settlement Receipt</span>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <span className="text-xs font-mono text-brand-blue font-bold truncate max-w-[170px]">
                        {verdictData.settlement?.txId}
                      </span>
                      {verdictData.settlement?.txId && verdictData.settlement?.txId !== "unknown" && (
                        <a 
                          href={`https://lora.algokit.io/testnet/transaction/${verdictData.settlement.txId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-brand-blue hover:underline flex items-center gap-1 font-bold tracking-tight"
                        >
                          <ExternalLink className="w-3 h-3" />
                          View Block
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* 4b. Interactive Developer Integration Code Snippets */}
        <div className="mt-12 premium-card rounded-3xl p-8 border border-white/10 relative overflow-hidden">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <span className="text-[10px] font-bold text-brand-blue uppercase tracking-widest font-display">Developer Drop-In</span>
              <h3 className="text-xl font-black text-white font-display mt-1">2-Line AI Agent Integration</h3>
              <p className="text-xs text-text-secondary mt-1">Wrap your AI agent's fetch client to enforce spend limits & merchant checks automatically.</p>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Tab selector */}
              <div className="flex bg-bg-navy-dark border border-white/10 p-1 rounded-xl">
                <button
                  onClick={() => setCodeTab("ts")}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    codeTab === "ts" ? 'bg-brand-blue text-white' : 'text-text-secondary hover:text-white'
                  }`}
                >
                  TypeScript (Node)
                </button>
                <button
                  onClick={() => setCodeTab("py")}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    codeTab === "py" ? 'bg-brand-blue text-white' : 'text-text-secondary hover:text-white'
                  }`}
                >
                  Python (AI Agent)
                </button>
              </div>

              {/* Copy code button */}
              <button
                onClick={() => {
                  const tsCode = `import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";\nimport { ExactAvmScheme } from "@x402/avm/exact/client";\nimport { toClientAvmSigner } from "@x402/avm";\n\nconst signer = toClientAvmSigner(process.env.AGENT_SECRET_KEY);\nconst config = { schemes: [{ network: "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=", client: new ExactAvmScheme(signer) }] };\nconst auditedFetch = wrapFetchWithPaymentFromConfig(fetch, config);\n\n// 🚀 All requests are now verified by AgentGuard on-chain before payment!\nconst res = await auditedFetch("https://agentguard.bakshibhavi.workers.dev/api/check", {\n  method: "POST",\n  body: JSON.stringify({ merchantAddress: "api.algometrics.org", claimedPrice: { amount: "10000", asset: "USDC" } })\n});\nconst verdict = await res.json();`;
                  const pyCode = `import requests\nfrom x402 import wrap_session\n\n# Wrap your standard requests session with AgentGuard x402 firewall\nsession = wrap_session(private_key=os.environ["AGENT_PRIVATE_KEY"])\n\n# 🚀 Automatic pre-payment trust audit settled on Algorand!\nresponse = session.post("https://agentguard.bakshibhavi.workers.dev/api/check", json={\n    "merchantAddress": "api.algometrics.org",\n    "claimedPrice": {"amount": "10000", "asset": "USDC"}\n})\nverdict = response.json()\nprint(f"Safety Decision: {verdict['trust']['recommendation']}")`;
                  
                  copyToClipboard(codeTab === "ts" ? tsCode : pyCode, setCopiedCode);
                }}
                className="p-2 text-xs font-bold rounded-xl border border-white/10 hover:bg-white/5 transition-colors flex items-center gap-1.5 text-text-primary cursor-pointer"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-brand-emerald" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedCode ? "Copied!" : "Copy Code"}
              </button>
            </div>
          </div>

          {/* Code block display */}
          <div className="bg-[#050505] border border-white/10 rounded-2xl p-5 font-mono text-xs text-text-primary overflow-x-auto leading-relaxed">
            {codeTab === "ts" ? (
              <pre className="text-brand-blue/90">
{`import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactAvmScheme } from "@x402/avm/exact/client";
import { toClientAvmSigner } from "@x402/avm";

// 1. Recover your agent's private key
const signer = toClientAvmSigner(process.env.AGENT_SECRET_KEY);
const config = { schemes: [{ network: "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=", client: new ExactAvmScheme(signer) }] };

// 2. Wrap native fetch with x402 pre-payment security gate
const auditedFetch = wrapFetchWithPaymentFromConfig(fetch, config);

// 🚀 Request is automatically audited on Algorand Testnet before funds release!
const res = await auditedFetch("https://agentguard.bakshibhavi.workers.dev/api/check", {
  method: "POST",
  body: JSON.stringify({ merchantAddress: "api.algometrics.org", claimedPrice: { amount: "10000", asset: "USDC" } })
});
const verdict = await res.json();
console.log(verdict.trust.verdict); // "trusted"`}
              </pre>
            ) : (
              <pre className="text-brand-emerald/90">
{`import requests
from x402 import wrap_session

# 1. Wrap standard python requests session with AgentGuard x402 firewall
session = wrap_session(private_key=os.environ["AGENT_PRIVATE_KEY"])

# 🚀 Automated pre-payment trust audit settled on Algorand Testnet!
response = session.post("https://agentguard.bakshibhavi.workers.dev/api/check", json={
    "merchantAddress": "api.algometrics.org",
    "claimedPrice": {"amount": "10000", "asset": "USDC"}
})

verdict = response.json()
if verdict["trust"]["recommendation"] == "proceed":
    print("Safe to pay merchant! Releasing primary payment...")`}
              </pre>
            )}
          </div>
        </div>
      </section>

      {/* 5. Feature Highlights (Awwwards Grids with dynamic Mouse Spotlights) */}
      <section id="features" className="reveal-section w-full max-w-7xl mx-auto px-6 py-20 relative z-10 border-t border-white/5">
        
        <div className="text-center mb-16">
          <span className="text-[10px] font-bold text-brand-magenta uppercase tracking-widest font-display">System Features</span>
          <h2 className="text-4xl font-black text-white font-display mt-2">Why Digital Infrastructure?</h2>
          <p className="text-text-secondary text-sm mt-3 max-w-xl mx-auto">
            A reliable, pay-per-call trust and spend policy firewall built specifically for machine-to-machine transactions.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { title: "Policy Firewall", desc: "Enforces granular per-call and daily remaining limits before transactions submit to the blockchain.", icon: Sliders, color: "text-brand-violet", bg: "bg-brand-violet/10" },
            { title: "Atomic Settlement", desc: "Leverages Algorand's atomic groups to structure gasless USDC checks and trigger instant release.", icon: Layers, color: "text-brand-blue", bg: "bg-brand-blue/10" },
            { title: "Registry Discovery", desc: "Queries the GoPlausible Bazaar registry on-chain to search and verify merchant history.", icon: ShieldCheck, color: "text-brand-emerald", bg: "bg-brand-emerald/10" }
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <div 
                key={idx}
                onMouseMove={handleMouseMove}
                className="premium-card spotlight-card rounded-2xl p-7 flex flex-col gap-4 relative overflow-hidden"
              >
                <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center self-start shadow-md`}>
                  <Icon className={`w-5.5 h-5.5 ${item.color}`} />
                </div>
                <div className="flex flex-col gap-2">
                  <h4 className="font-extrabold text-white text-base font-display">{item.title}</h4>
                  <p className="text-xs text-text-secondary leading-relaxed">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. FAQ Section Accordion */}
      <section id="faq" className="reveal-section w-full max-w-4xl mx-auto px-6 py-20 relative z-10 border-t border-white/5">
        <div className="text-center mb-12">
          <span className="text-[10px] font-bold text-brand-violet uppercase tracking-widest font-display">Documentation</span>
          <h2 className="text-3xl font-black text-white font-display mt-2">Frequently Asked Questions</h2>
        </div>

        <div className="flex flex-col gap-4">
          {faqs.map((faq, idx) => (
            <div 
              key={idx}
              className="premium-card rounded-2xl overflow-hidden transition-all duration-300"
            >
              <button 
                onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                className="w-full text-left p-6 flex justify-between items-center text-sm font-bold text-white font-display"
              >
                <span>{faq.q}</span>
                <ChevronDown className={`w-4 h-4 text-text-secondary transition-transform duration-300 ${activeFaq === idx ? 'rotate-180' : ''}`} />
              </button>
              
              <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
                activeFaq === idx ? 'max-h-40 border-t border-white/5 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
              }`}>
                <div className="p-6 text-xs text-text-secondary leading-relaxed bg-[#0a0a0f]/30">
                  {faq.a}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 8. Futuristic Footer */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-16 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 relative z-10">
        
        {/* Footer logo */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold font-display text-white">AgentGuard</span>
        </div>

        <p className="text-xs text-text-secondary">
          © 2026 AgentGuard. Autonomous Micropayment Security Infrastructure · Secured on Algorand.
        </p>

        {/* Social link placeholder icons */}
        <div className="flex items-center gap-4">
          <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Algorand Network</span>
        </div>

      </footer>
      
    </div>
  );
}

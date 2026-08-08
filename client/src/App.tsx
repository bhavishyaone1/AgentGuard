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
  Layers,
  ChevronDown,
  ArrowRight,
  Code2,
  Activity,
  CheckCheck,
  Zap,
  Lock,
  Globe
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
    status: "trusted",
    defaultPrice: "10000"
  },
  { 
    name: "Compx Amarok API", 
    tag: "Verified On-Chain", 
    desc: "Active Algorand merchant with 18,800+ on-chain verifications.",
    address: "XJCCGGJ6FL6CFYNXCTO6Q5YQ7E2OIYVRX2G3BVZUF4JOL36HSJRPLYHW5E",
    status: "verified",
    defaultPrice: "10000"
  },
  { 
    name: "Unknown Scammer Mock", 
    tag: "High-Risk Mock", 
    desc: "Fake address with 0 history. Tests firewall blocking.",
    address: "7Y4TGDJSHS5J4LHGKSLK5HJSKL44JLJDFSLDJKDFSD45FDGDFGDFGDG2",
    status: "high_risk",
    defaultPrice: "10000"
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
  const [copiedAddress, setCopiedAddress] = useState<boolean>(false);

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
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [verdictData, setVerdictData] = useState<any>(null);

  // UI interaction states
  const [navbarShrunk, setNavbarShrunk] = useState<boolean>(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [codeTab, setCodeTab] = useState<"ts" | "py" | "langchain" | "crewai">("ts");
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
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

  // Initialize or load wallet on mount
  useEffect(() => {
    const saved = localStorage.getItem("agentguard_payer_mnemonic");
    if (saved) {
      recoverWallet(saved);
    } else {
      // Default to funded testnet demo wallet for seamless out-of-the-box testing
      const DEMO_MNEMONIC = "sun sign term dash tube control method lumber elephant cause illegal arch pioneer soccer juice search isolate chimney thunder course liquid alarm element able catalog";
      recoverWallet(DEMO_MNEMONIC);
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
      
      addLog("Waiting for confirmation on Algorand testnet...", "info");
      await algosdk.waitForConfirmation(algodClient, txId, 4);
      addLog("🎉 Opt-in transaction confirmed! Account ready for USDC.", "success");
      
      await fetchBalances(account.addr);
    } catch (err: any) {
      addLog(`Opt-in failed: ${err.message || err}`, "error");
    } finally {
      setWalletLoading(false);
    }
  };

  const copyToClipboard = (text: string, setCopied: (v: boolean) => void) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
    { 
      q: "What is AgentGuard?", 
      a: "AgentGuard is an on-chain pre-payment security firewall for autonomous AI agents. Before an agent sends payments to an API vendor, AgentGuard intercepts the request, audits the merchant on the GoPlausible Bazaar registry, evaluates local spend rules, and blocks fraud or overcharging." 
    },
    { 
      q: "Why does an unknown address score 15/100?", 
      a: "If a target address is not registered on the GoPlausible Bazaar index, has zero on-chain settlement record, or belongs to another network (like Ethereum/EVM), AgentGuard flags it as High Risk (15/100) and recommends ABORT to prevent wallet drainage." 
    },
    { 
      q: "How does the x402 Micropayment Standard work?", 
      a: "The server returns an HTTP 402 Payment Required response containing payment parameters. The client-side @x402/fetch SDK intercepts the 402, signs the Algorand transaction group, settles the $0.01 USDC check fee via the facilitator, and retries automatically." 
    },
    { 
      q: "Who pays for the blockchain network fees?", 
      a: "AgentGuard uses Algorand's atomic transaction groups to structure a gasless transfer. The GoPlausible facilitator sponsors the native ALGO network fees, meaning paying agents only require USDC." 
    },
    { 
      q: "How do I integrate AgentGuard into LangChain or CrewAI?", 
      a: "Wrap your agent's API tool with the AgentGuard security gate. Check the 'Developer SDK' section below for copy-paste code snippets for LangChain, CrewAI, Python, and TypeScript." 
    }
  ];

  return (
    <div className="min-h-screen text-text-primary flex flex-col relative overflow-hidden bg-bg-navy selection:bg-brand-violet selection:text-white">
      
      {/* Background Aurora & Grid Pattern */}
      <div className="aurora-bg"></div>
      <div className="grid-overlay"></div>

      {/* Ambient Custom Cursor Glow */}
      <div 
        className="hidden lg:block custom-cursor-glow" 
        style={{ left: `${mousePos.x}px`, top: `${mousePos.y}px` }}
      ></div>

      {/* Floating Glass Navbar */}
      <header className={`fixed top-4 left-1/2 -translate-x-1/2 w-[94%] max-w-6xl rounded-full z-50 transition-all duration-300 ${
        navbarShrunk 
          ? "bg-bg-navy/85 border-white/10 shadow-2xl py-3 px-6 backdrop-blur-xl" 
          : "bg-bg-navy/40 border-white/5 py-4 px-8 backdrop-blur-md"
      } border flex justify-between items-center shadow-lg shadow-black/40`}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-violet to-brand-blue flex items-center justify-center shadow-md shadow-brand-violet/20">
            <ShieldCheck className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm tracking-tight font-display text-white">AgentGuard</span>
            <span className="hidden sm:inline-flex items-center gap-1 text-[9px] font-mono font-bold px-2 py-0.5 rounded-full bg-brand-emerald/15 text-brand-emerald border border-brand-emerald/30">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-emerald animate-pulse"></span>
              Algorand Live
            </span>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-1 bg-bg-navy-dark/60 border border-white/10 p-1 rounded-full">
          {[
            { id: "hero", label: "Overview" },
            { id: "sandbox", label: "Live Sandbox" },
            { id: "scoring", label: "Scoring Matrix" },
            { id: "sdk", label: "Developer SDK" },
            { id: "architecture", label: "Architecture" },
            { id: "faq", label: "FAQ" }
          ].map((item) => (
            <a 
              key={item.id}
              href={`#${item.id}`}
              className="text-xs font-semibold text-text-secondary hover:text-white px-3.5 py-1.5 rounded-full transition-all hover:bg-white/5 cursor-pointer"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div>
          <a 
            href="#sandbox"
            className="text-[10px] font-extrabold bg-gradient-to-r from-brand-violet to-brand-blue hover:from-brand-violet/90 hover:to-brand-blue/90 text-white px-4.5 py-2 rounded-full transition-all uppercase tracking-wider shadow-lg shadow-brand-violet/20 font-display flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3 h-3" />
            Launch Console
          </a>
        </div>
      </header>

      {/* Main Container */}
      <main className="w-full max-w-7xl mx-auto px-6 pt-32 pb-24 relative z-10 flex flex-col gap-24">
        
        {/* ============================================================ */}
        {/* SECTION 1: HERO & PILLAR OVERVIEW CARDS                     */}
        {/* ============================================================ */}
        <section id="hero" className="flex flex-col gap-10 text-center items-center pt-8">
          
          <div className="inline-flex items-center gap-2 bg-brand-violet/10 border border-brand-violet/20 px-4 py-1.5 rounded-full shadow-lg shadow-brand-violet/5">
            <Sparkles className="w-4 h-4 text-brand-violet" />
            <span className="text-[11px] font-extrabold text-brand-violet uppercase tracking-widest font-display">
              Autonomous Micropayment Firewall · Algorand Native
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl font-black tracking-tight text-white leading-[1.05] font-display max-w-4xl">
            The Trust Layer <br />
            for <span className="bg-gradient-to-r from-brand-violet via-brand-cyan to-brand-emerald bg-clip-text text-transparent">AI Commerce</span>
          </h1>

          <p className="text-text-secondary text-base md:text-lg leading-relaxed max-w-2xl">
            Protect autonomous AI agents from wallet drainage, fraudulent merchant APIs, and unexpected cost spikes. Audits endpoints on-chain before funds move.
          </p>

          {/* Quick Jump Buttons */}
          <div className="flex flex-wrap gap-4 justify-center items-center">
            <a 
              href="#sandbox"
              className="text-xs font-extrabold bg-gradient-to-r from-brand-violet via-brand-blue to-brand-cyan text-white px-8 py-4 rounded-full shadow-xl shadow-brand-violet/20 hover:opacity-95 transition-all uppercase tracking-wider font-display"
            >
              Enter Live Sandbox →
            </a>
            <a 
              href="#sdk"
              className="text-xs font-extrabold border border-white/10 hover:border-white/20 text-white px-8 py-4 rounded-full transition-all uppercase tracking-wider bg-white/3"
            >
              View 2-Line SDK
            </a>
          </div>

          {/* 4 Interactive Pillar Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full mt-4 text-left">
            <a href="#sandbox" className="premium-card p-5 rounded-2xl flex flex-col gap-2 hover:border-brand-emerald/30 cursor-pointer">
              <div className="w-8 h-8 rounded-lg bg-brand-emerald/10 text-brand-emerald flex items-center justify-center">
                <ShieldCheck className="w-4.5 h-4.5" />
              </div>
              <h3 className="text-sm font-bold text-white font-display mt-1">Pre-Payment Firewall</h3>
              <p className="text-[11px] text-text-secondary">Enforces per-call and daily budget ceilings before AVM signing.</p>
            </a>

            <a href="#scoring" className="premium-card p-5 rounded-2xl flex flex-col gap-2 hover:border-brand-blue/30 cursor-pointer">
              <div className="w-8 h-8 rounded-lg bg-brand-blue/10 text-brand-blue flex items-center justify-center">
                <Activity className="w-4.5 h-4.5" />
              </div>
              <h3 className="text-sm font-bold text-white font-display mt-1">On-Chain Scoring</h3>
              <p className="text-[11px] text-text-secondary">Evaluates merchant discovery standing (0–100) via Bazaar index.</p>
            </a>

            <a href="#sdk" className="premium-card p-5 rounded-2xl flex flex-col gap-2 hover:border-brand-violet/30 cursor-pointer">
              <div className="w-8 h-8 rounded-lg bg-brand-violet/10 text-brand-violet flex items-center justify-center">
                <Code2 className="w-4.5 h-4.5" />
              </div>
              <h3 className="text-sm font-bold text-white font-display mt-1">Multi-Framework SDK</h3>
              <p className="text-[11px] text-text-secondary">Drop-in tools for LangChain, CrewAI, Python, and TypeScript.</p>
            </a>

            <a href="#architecture" className="premium-card p-5 rounded-2xl flex flex-col gap-2 hover:border-brand-amber/30 cursor-pointer">
              <div className="w-8 h-8 rounded-lg bg-brand-amber/10 text-brand-amber flex items-center justify-center">
                <Layers className="w-4.5 h-4.5" />
              </div>
              <h3 className="text-sm font-bold text-white font-display mt-1">Gasless AVM Groups</h3>
              <p className="text-[11px] text-text-secondary">Facilitator-sponsored ALGO fees with 3.3s on-chain settlement.</p>
            </a>
          </div>

        </section>

        {/* ============================================================ */}
        {/* SECTION 2: LIVE INTERACTIVE SANDBOX CONSOLE                 */}
        {/* ============================================================ */}
        <section id="sandbox" className="flex flex-col gap-8 scroll-mt-28">
          
          {/* Section Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-bg-navy-light/60 border border-white/10 p-6 rounded-3xl backdrop-blur-md">
            <div>
              <span className="text-[10px] font-bold text-brand-violet uppercase tracking-widest font-display">Security Sandbox</span>
              <h2 className="text-2xl md:text-3xl font-black text-white font-display mt-1">Live Payment & Fraud Audit Console</h2>
              <p className="text-xs text-text-secondary mt-1 max-w-xl">
                Test how AgentGuard intercepts x402 challenges, audits merchant registries on Algorand, and displays real-time verdicts.
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono border-t md:border-t-0 md:border-l border-white/10 pt-3 md:pt-0 md:pl-6">
              <div>
                <span className="text-text-faint block text-[9px]">QUERY FEE</span>
                <span className="text-brand-blue font-bold">0.01 USDC</span>
              </div>
              <div>
                <span className="text-text-faint block text-[9px]">FINALITY</span>
                <span className="text-brand-emerald font-bold">~3.3s</span>
              </div>
              <div>
                <span className="text-text-faint block text-[9px]">NETWORK</span>
                <span className="text-white font-bold">Algorand</span>
              </div>
            </div>
          </div>

          {/* 2-Column Console Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Column: Wallet & Spend Rules (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              
              {/* Payer Wallet Card */}
              <div className="premium-card rounded-2xl p-6 flex flex-col gap-4 relative overflow-hidden">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-brand-emerald" />
                    Payer Wallet
                  </h3>
                  <button 
                    onClick={() => fetchBalances(payerAddress)}
                    disabled={walletLoading}
                    className="p-1.5 text-text-secondary hover:text-white rounded-lg hover:bg-white/5 transition-all cursor-pointer"
                    title="Refresh Balance"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${walletLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {/* 1-Click Funded Demo Wallet Button */}
                <button 
                  onClick={loadDemoWallet}
                  disabled={walletLoading}
                  className="w-full text-xs font-bold py-2.5 rounded-xl bg-brand-emerald/15 text-brand-emerald border border-brand-emerald/30 hover:bg-brand-emerald/25 transition-all uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-brand-emerald/5"
                >
                  <Sparkles className="w-4 h-4" />
                  Load Funded Demo Wallet (19.90 USDC)
                </button>

                {/* Address Display */}
                <div className="bg-bg-navy-dark border border-white/5 p-4 rounded-xl flex flex-col gap-1.5">
                  <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Address</span>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono truncate text-white max-w-[280px]">
                      {payerAddress || "Generating..."}
                    </span>
                    <button 
                      onClick={() => copyToClipboard(payerAddress, setCopiedAddress)}
                      className="p-1 text-text-secondary hover:text-white rounded transition-colors cursor-pointer"
                    >
                      {copiedAddress ? <Check className="w-3.5 h-3.5 text-brand-emerald" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Balances Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-bg-navy-dark border border-white/5 p-3.5 rounded-xl text-center">
                    <span className="text-[9px] font-bold text-text-secondary uppercase tracking-wider block">ALGO Balance</span>
                    <span className="text-lg font-black text-white mt-1 block font-mono">{algoBalance.toFixed(3)}</span>
                  </div>
                  <div className="bg-bg-navy-dark border border-white/5 p-3.5 rounded-xl text-center">
                    <span className="text-[9px] font-bold text-text-secondary uppercase tracking-wider block">USDC Balance</span>
                    <span className="text-lg font-black text-brand-blue mt-1 block font-mono">{usdcBalance.toFixed(2)}</span>
                  </div>
                </div>

                {/* USDC Opt-In Status */}
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

                  <div className="flex gap-2">
                    <button 
                      onClick={executeOptIn}
                      disabled={walletLoading || isOptedIn}
                      className="flex-1 text-xs font-bold py-2.5 rounded-xl bg-brand-blue hover:bg-brand-blue/90 disabled:opacity-50 transition-colors uppercase tracking-wider cursor-pointer"
                    >
                      Opt-in to USDC
                    </button>
                    <button 
                      onClick={generateNewWallet}
                      disabled={walletLoading}
                      className="text-xs font-bold py-2.5 px-4 rounded-xl border border-white/10 hover:bg-white/5 transition-colors uppercase tracking-wider cursor-pointer"
                    >
                      Generate
                    </button>
                  </div>
                </div>

                {/* Mnemonic Copy */}
                <div className="border-t border-white/5 pt-3 flex justify-between items-center text-xs">
                  <span className="font-semibold text-text-secondary text-[11px]">Secret Mnemonic</span>
                  <button 
                    onClick={() => copyToClipboard(payerMnemonic, setCopiedMnemonic)}
                    className="text-[10px] font-bold text-brand-violet hover:underline flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedMnemonic ? (
                      <>
                        <Check className="w-3 h-3 text-brand-emerald" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Copy Words
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Spend Policy Panel */}
              <div className="premium-card rounded-2xl p-6 flex flex-col gap-6 relative overflow-hidden">
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
                    min="5000" 
                    max="100000" 
                    step="5000" 
                    value={maxPerCall}
                    onChange={(e) => setMaxPerCall(e.target.value)}
                    className="w-full accent-brand-violet bg-white/10 h-1 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-[10px] text-text-secondary leading-normal">
                    Fails check automatically if claimed price exceeds this threshold.
                  </span>
                </div>

                {/* Daily limit */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-white">Daily Remaining Limit</span>
                    <span className="font-mono text-brand-violet font-semibold">{(Number(maxDailyRemaining) / 1000000).toFixed(4)} USDC</span>
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

            {/* Right Column: Query, Execution & Verdict (7 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              
              {/* Target Settings Card */}
              <div className="premium-card rounded-2xl p-6 flex flex-col gap-5">
                <div className="flex flex-col gap-1">
                  <h3 className="text-xs font-bold text-text-secondary uppercase tracking-widest flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-brand-blue" />
                    Target Merchant Query
                  </h3>
                  <p className="text-[10px] text-text-secondary leading-normal mt-1">
                    Select a preset or enter any custom API endpoint/address:
                  </p>
                </div>

                {/* Merchant Presets Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {DEMO_MERCHANTS.map((m) => (
                    <button 
                      key={m.name}
                      onClick={() => {
                        setTargetMerchant(m.address);
                        setClaimedPriceAmt(m.defaultPrice);
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

                {/* Custom Inputs */}
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
                      type="number" 
                      value={claimedPriceAmt}
                      onChange={(e) => setClaimedPriceAmt(e.target.value)}
                      placeholder="10000"
                      className="bg-bg-navy-dark border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-brand-blue font-mono"
                    />
                  </div>
                </div>

                {/* Action CTA Button */}
                <button 
                  onClick={handlePrePaymentCheck}
                  disabled={checking}
                  className="w-full py-4 rounded-xl bg-gradient-to-r from-brand-violet via-brand-blue to-brand-cyan text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-50 transition-all cursor-pointer shadow-lg shadow-brand-violet/20 font-display"
                >
                  {checking ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Executing Pre-Payment Verification...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      Execute Pre-Payment Check ($0.01 USDC Fee)
                    </>
                  )}
                </button>
              </div>

              {/* Live Terminal Log */}
              <div className="premium-card rounded-2xl p-6 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-text-secondary uppercase tracking-widest flex items-center gap-2">
                    <TerminalIcon className="w-4 h-4 text-brand-cyan" />
                    Live Agent Terminal Log
                  </span>
                  <span className="text-[9px] font-mono text-text-faint">Interactive Sandbox</span>
                </div>

                <div className="w-full h-44 bg-bg-navy-dark border border-white/10 rounded-xl p-4 font-mono text-[11px] overflow-y-auto flex flex-col gap-2 shadow-inner">
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

                  {/* Reasons List */}
                  <div className="bg-bg-navy-dark border border-white/5 rounded-xl p-4 flex flex-col gap-2.5">
                    <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block">Registry Verification Logic</span>
                    {verdictData.trust?.reasons?.map((reason: string, idx: number) => (
                      <div key={idx} className="flex items-start gap-2.5 text-xs text-text-primary leading-normal">
                        <ArrowRight className="w-3.5 h-3.5 text-brand-violet shrink-0 mt-0.5" />
                        <span>{reason}</span>
                      </div>
                    ))}
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
        </section>

        {/* ============================================================ */}
        {/* SECTION 3: SCORING ENGINE ARCHITECTURE MATRIX               */}
        {/* ============================================================ */}
        <section id="scoring" className="flex flex-col gap-8 scroll-mt-28">
          <div className="premium-card rounded-3xl p-8 border border-white/10">
            <div className="flex flex-col gap-2 mb-8">
              <span className="text-[10px] font-bold text-brand-emerald uppercase tracking-widest font-display">Algorithmic Scoring Matrix</span>
              <h2 className="text-3xl font-black text-white font-display">How AgentGuard Calculates Trust (0–100)</h2>
              <p className="text-xs text-text-secondary max-w-2xl">
                Scores are calculated deterministically on-chain based on Bazaar registry discovery, historical settlement volume, and catalog price schemas.
              </p>
            </div>

            {/* 4 Score Tiers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              {/* 100 Tier */}
              <div className="bg-bg-navy-dark border border-brand-emerald/30 p-6 rounded-2xl flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-white">Verified Elite</span>
                  <span className="text-xs font-black px-2.5 py-1 rounded bg-brand-emerald/15 text-brand-emerald font-mono">100 / 100</span>
                </div>
                <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-emerald w-full rounded-full"></div>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Registered in Bazaar + active settlements + claimed price <b>matches declared catalog schema</b>.
                </p>
                <div className="mt-auto pt-3 border-t border-white/5 flex items-center justify-between text-[10px] font-mono">
                  <span className="text-text-faint">ACTION:</span>
                  <span className="text-brand-emerald font-bold uppercase">PROCEED ✅</span>
                </div>
              </div>

              {/* 85 Tier */}
              <div className="bg-bg-navy-dark border border-brand-blue/30 p-6 rounded-2xl flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-white">Trusted Vendor</span>
                  <span className="text-xs font-black px-2.5 py-1 rounded bg-brand-blue/15 text-brand-blue font-mono">85 / 100</span>
                </div>
                <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-blue w-[85%] rounded-full"></div>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Registered in Bazaar with <b>proven settlement history</b> (e.g. 90+ verified settles on Algorand).
                </p>
                <div className="mt-auto pt-3 border-t border-white/5 flex items-center justify-between text-[10px] font-mono">
                  <span className="text-text-faint">ACTION:</span>
                  <span className="text-brand-blue font-bold uppercase">PROCEED ✅</span>
                </div>
              </div>

              {/* 50 Tier */}
              <div className="bg-bg-navy-dark border border-brand-amber/30 p-6 rounded-2xl flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-white">Unverified New</span>
                  <span className="text-xs font-black px-2.5 py-1 rounded bg-brand-amber/15 text-brand-amber font-mono">50 / 100</span>
                </div>
                <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-amber w-1/2 rounded-full"></div>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Registered public key in index, but has <b>0 historical transactions</b> (brand-new provider).
                </p>
                <div className="mt-auto pt-3 border-t border-white/5 flex items-center justify-between text-[10px] font-mono">
                  <span className="text-text-faint">ACTION:</span>
                  <span className="text-brand-amber font-bold uppercase">CAUTION ⚠️</span>
                </div>
              </div>

              {/* 15 Tier */}
              <div className="bg-bg-navy-dark border border-brand-rose/30 p-6 rounded-2xl flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-white">High Risk / Scam</span>
                  <span className="text-xs font-black px-2.5 py-1 rounded bg-brand-rose/15 text-brand-rose font-mono">15 / 100</span>
                </div>
                <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-rose w-[15%] rounded-full"></div>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  <b>Unregistered target</b> or foreign-chain address with 0 record. Firewall blocks payment to save funds.
                </p>
                <div className="mt-auto pt-3 border-t border-white/5 flex items-center justify-between text-[10px] font-mono">
                  <span className="text-text-faint">ACTION:</span>
                  <span className="text-brand-rose font-bold uppercase">ABORT 🛑</span>
                </div>
              </div>
            </div>

            {/* Explainer Box: Why 15/100? */}
            <div className="mt-8 bg-bg-navy-dark border border-brand-amber/20 rounded-2xl p-6 flex items-start gap-4">
              <AlertTriangle className="w-5 h-5 text-brand-amber shrink-0 mt-1" />
              <div className="flex flex-col gap-2 text-xs">
                <h4 className="text-sm font-bold text-white font-display">Why did my target address score 15/100?</h4>
                <p className="text-text-secondary leading-relaxed">
                  AgentGuard implements a <b>Zero-Trust Security Model</b>. If an address is unregistered in the GoPlausible Bazaar index, has zero on-chain settlement history, or belongs to another network (such as Ethereum <code>0xdac1...</code>), AgentGuard immediately assigns a <b>15/100 HIGH RISK</b> rating and instructs your AI agent to <b>ABORT</b> to prevent irreversible wallet drainage.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* SECTION 4: MULTI-FRAMEWORK AI AGENT SDK                     */}
        {/* ============================================================ */}
        <section id="sdk" className="flex flex-col gap-8 scroll-mt-28">
          <div className="premium-card rounded-3xl p-8 border border-white/10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <span className="text-[10px] font-bold text-brand-blue uppercase tracking-widest font-display">Developer Drop-In</span>
                <h2 className="text-3xl font-black text-white font-display mt-1">Multi-Framework AI Agent SDK</h2>
                <p className="text-xs text-text-secondary mt-1">Select your agent framework to view and copy the 3-line security wrapper.</p>
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                {/* Tab Selectors */}
                <div className="flex bg-bg-navy-dark border border-white/10 p-1 rounded-xl">
                  {[
                    { id: "ts", label: "TypeScript" },
                    { id: "py", label: "Python (Native)" },
                    { id: "langchain", label: "LangChain" },
                    { id: "crewai", label: "CrewAI" }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setCodeTab(tab.id as any)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                        codeTab === tab.id ? 'bg-brand-blue text-white' : 'text-text-secondary hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Copy Code Button */}
                <button
                  onClick={() => {
                    const snippets: Record<string, string> = {
                      ts: `import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";\nimport { ExactAvmScheme } from "@x402/avm/exact/client";\nimport { toClientAvmSigner } from "@x402/avm";\n\nconst signer = toClientAvmSigner(process.env.AGENT_SECRET_KEY);\nconst config = { schemes: [{ network: "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=", client: new ExactAvmScheme(signer) }] };\nconst auditedFetch = wrapFetchWithPaymentFromConfig(fetch, config);\n\n// 🚀 All requests are verified by AgentGuard on-chain before payment!\nconst res = await auditedFetch("https://agentguard.bakshibhavi.workers.dev/api/check", {\n  method: "POST",\n  body: JSON.stringify({ merchantAddress: "api.algometrics.org", claimedPrice: { amount: "10000", asset: "USDC" } })\n});\nconst verdict = await res.json();\nif (verdict.trust.recommendation === "proceed") {\n  console.log("Safe to pay merchant!");\n}`,
                      py: `import requests\nfrom x402 import wrap_session\n\n# Wrap standard python session with AgentGuard firewall\nsession = wrap_session(private_key=os.environ["AGENT_PRIVATE_KEY"])\n\n# 🚀 Automated pre-payment trust audit on Algorand Testnet!\nresponse = session.post("https://agentguard.bakshibhavi.workers.dev/api/check", json={\n    "merchantAddress": "api.algometrics.org",\n    "claimedPrice": {"amount": "10000", "asset": "USDC"}\n})\nverdict = response.json()\nif verdict["trust"]["recommendation"] == "proceed":\n    print("Safe to pay merchant! Releasing primary payment...")`,
                      langchain: `from langchain.tools import tool\nimport requests\n\n@tool\ndef agentguard_pre_payment_check(merchant_url: str, amount_usdc: str) -> str:\n    """Audits a merchant endpoint on Algorand before releasing payment."""\n    res = requests.post("https://agentguard.bakshibhavi.workers.dev/api/check", json={\n        "merchantAddress": merchant_url,\n        "claimedPrice": {"amount": amount_usdc, "asset": "USDC"}\n    })\n    verdict = res.json()\n    if verdict["trust"]["recommendation"] != "proceed":\n        raise Exception(f"Security Alert: High risk merchant blocked! ({verdict['trust']['reputationScore']}/100)")\n    return "VERIFIED SAFE: Proceed with purchase."`,
                      crewai: `from crewai_tools import tool\nimport requests\n\n@tool("AgentGuard Security Gate")\ndef audit_merchant(merchant_address: str, price_base: str) -> str:\n    """Audits merchant trust and spend limits on Algorand before paying."""\n    r = requests.post("https://agentguard.bakshibhavi.workers.dev/api/check", json={\n        "merchantAddress": merchant_address,\n        "claimedPrice": {"amount": price_base, "asset": "USDC"}\n    })\n    data = r.json()\n    return f"Verdict: {data['trust']['verdict'].upper()} (Score: {data['trust']['reputationScore']}/100)"`
                    };
                    copyToClipboard(snippets[codeTab], setCopiedCode);
                  }}
                  className="p-2 text-xs font-bold rounded-xl border border-white/10 hover:bg-white/5 transition-colors flex items-center gap-1.5 text-text-primary cursor-pointer shrink-0"
                >
                  {copiedCode ? <CheckCheck className="w-3.5 h-3.5 text-brand-emerald" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedCode ? "Copied!" : "Copy Code"}
                </button>
              </div>
            </div>

            {/* Code Block */}
            <div className="bg-[#020202] border border-white/10 rounded-2xl p-6 font-mono text-xs text-text-primary overflow-x-auto leading-relaxed">
              {codeTab === "ts" && (
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
if (verdict.trust.recommendation === "proceed") {
  console.log("Safe to pay merchant!");
}`}
                </pre>
              )}

              {codeTab === "py" && (
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

              {codeTab === "langchain" && (
                <pre className="text-brand-violet/90">
{`from langchain.tools import tool
import requests

@tool
def agentguard_pre_payment_check(merchant_url: str, amount_usdc: str) -> str:
    """Audits a merchant endpoint on Algorand before releasing payment."""
    res = requests.post("https://agentguard.bakshibhavi.workers.dev/api/check", json={
        "merchantAddress": merchant_url,
        "claimedPrice": {"amount": amount_usdc, "asset": "USDC"}
    })
    verdict = res.json()
    if verdict["trust"]["recommendation"] != "proceed":
        raise Exception(f"Security Alert: High risk merchant blocked! ({verdict['trust']['reputationScore']}/100)")
    return "VERIFIED SAFE: Proceed with purchase."`}
                </pre>
              )}

              {codeTab === "crewai" && (
                <pre className="text-brand-amber/90">
{`from crewai_tools import tool
import requests

@tool("AgentGuard Security Gate")
def audit_merchant(merchant_address: str, price_base: str) -> str:
    """Audits merchant trust and spend limits on Algorand before paying."""
    r = requests.post("https://agentguard.bakshibhavi.workers.dev/api/check", json={
        "merchantAddress": merchant_address,
        "claimedPrice": {"amount": price_base, "asset": "USDC"}
    })
    data = r.json()
    return f"Verdict: {data['trust']['verdict'].upper()} (Score: {data['trust']['reputationScore']}/100)"`}
                </pre>
              )}
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* SECTION 5: PROTOCOL ARCHITECTURE PIPELINE                   */}
        {/* ============================================================ */}
        <section id="architecture" className="flex flex-col gap-8 scroll-mt-28">
          <div className="premium-card rounded-3xl p-8 border border-white/10">
            <div className="text-center mb-12">
              <span className="text-[10px] font-bold text-brand-violet uppercase tracking-widest font-display">System Integrity</span>
              <h2 className="text-3xl font-black text-white font-display mt-2">Interactive Protocol Architecture</h2>
              <p className="text-text-secondary text-sm mt-3 max-w-lg mx-auto">
                Trace the live verification pipeline from the payer's wallet to the facilitator registry and Algorand settlement.
              </p>
            </div>

            {/* Visual Pipeline */}
            <div className="overflow-x-auto py-6">
              <div className="min-w-[850px] flex items-center justify-between relative py-6">
                <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-white/5 -translate-y-1/2 z-0"></div>
                
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
                        isActive ? 'bg-brand-violet/20 border-brand-violet text-brand-violet scale-110 shadow-brand-violet/20' :
                        isPassed ? 'bg-brand-emerald/15 border-brand-emerald text-brand-emerald' :
                        'bg-white/5 border-white/10 text-text-secondary'
                      }`}>
                        <IconComp className="w-6 h-6" />
                      </div>
                      <div className="text-center flex flex-col gap-0.5">
                        <span className="text-xs font-bold text-white font-display">{node.label}</span>
                        <span className="text-[10px] text-text-secondary max-w-[120px]">{node.desc}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* SECTION 6: SYSTEM FEATURES                                   */}
        {/* ============================================================ */}
        <section id="features" className="flex flex-col gap-8 scroll-mt-28">
          <div className="text-center mb-4">
            <span className="text-[10px] font-bold text-brand-magenta uppercase tracking-widest font-display">System Features</span>
            <h2 className="text-4xl font-black text-white font-display mt-2">Why Digital Infrastructure?</h2>
            <p className="text-text-secondary text-sm mt-3 max-w-xl mx-auto">
              A reliable, pay-per-call trust and spend policy firewall built specifically for machine-to-machine transactions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { title: "Policy Firewall", desc: "Enforces granular per-call and daily remaining limits before transactions submit to the blockchain.", icon: Sliders, color: "text-brand-violet", bg: "bg-brand-violet/10" },
              { title: "Atomic Settlement", desc: "Leverages Algorand's atomic groups to structure gasless USDC checks and trigger instant release.", icon: Layers, color: "text-brand-blue", bg: "bg-brand-blue/10" },
              { title: "Registry Discovery", desc: "Queries the GoPlausible Bazaar registry on-chain to search and verify merchant history.", icon: ShieldCheck, color: "text-brand-emerald", bg: "bg-brand-emerald/10" },
              { title: "Zero Gas Delegation", desc: "Facilitators sponsor native ALGO network fees so agents only require USDC.", icon: Zap, color: "text-brand-cyan", bg: "bg-brand-cyan/10" },
              { title: "Zero-Trust Architecture", desc: "Blocks unregistered foreign-chain addresses to prevent wallet drainage.", icon: Lock, color: "text-brand-rose", bg: "bg-brand-rose/10" },
              { title: "Algorand Standard Asset", desc: "Native compliance with Algorand Standard Asset USDC (ASA ID 10458941).", icon: Globe, color: "text-brand-amber", bg: "bg-brand-amber/10" }
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <div 
                  key={idx}
                  className="premium-card rounded-2xl p-7 flex flex-col gap-4 relative overflow-hidden"
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

        {/* ============================================================ */}
        {/* SECTION 7: FAQ KNOWLEDGE BASE                               */}
        {/* ============================================================ */}
        <section id="faq" className="flex flex-col gap-8 scroll-mt-28 max-w-4xl mx-auto w-full">
          <div className="text-center mb-4">
            <span className="text-[10px] font-bold text-brand-violet uppercase tracking-widest font-display">Knowledge Base</span>
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
                  className="w-full text-left p-6 flex justify-between items-center text-sm font-bold text-white font-display cursor-pointer"
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

      </main>

      {/* Futuristic Footer */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-brand-violet to-brand-blue flex items-center justify-center">
            <ShieldCheck className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-xs font-bold font-display text-white">AgentGuard Protocol</span>
        </div>

        <p className="text-xs text-text-secondary text-center md:text-left">
          © 2026 AgentGuard. Autonomous Micropayment Security Infrastructure · Secured on Algorand.
        </p>

        {/* Ecosystem Links */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-text-secondary">
          <a 
            href="https://github.com/bhavishyaone1/AgentGuard" 
            target="_blank" 
            rel="noreferrer"
            className="hover:text-white transition-colors"
          >
            GitHub
          </a>
          <span className="text-white/10">•</span>
          <a 
            href="https://agentguard.bakshibhavi.workers.dev/api/health" 
            target="_blank" 
            rel="noreferrer"
            className="hover:text-brand-emerald transition-colors"
          >
            API Status
          </a>
          <span className="text-white/10">•</span>
          <a 
            href="https://bank.testnet.algorand.network/" 
            target="_blank" 
            rel="noreferrer"
            className="hover:text-brand-blue transition-colors"
          >
            Algorand Faucet
          </a>
          <span className="text-white/10">•</span>
          <a 
            href="https://facilitator.goplausible.xyz" 
            target="_blank" 
            rel="noreferrer"
            className="hover:text-brand-violet transition-colors"
          >
            GoPlausible Bazaar
          </a>
        </div>
      </footer>
      
    </div>
  );
}

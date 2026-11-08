import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import SEO from "../components/SEO";
import { 
  BellRing, 
  Send, 
  Check, 
  AlertCircle, 
  Code2, 
  Copy, 
  Shield, 
  Terminal, 
  Globe, 
  Clock, 
  MessageSquare,
  Eye, 
  EyeOff,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Save,
  Wrench,
  Trash2,
  Database,
  Cpu,
  Layers,
  Server,
  Webhook,
  Rss,
  ExternalLink,
  Plus,
  Edit2,
  RefreshCw,
  FolderPlus,
  Tag,
  Mail,
  Calendar,
  Download,
  Sparkles,
  Radio,
  LogOut,
  Lock
} from "lucide-react";
import { useToast } from "../lib/ToastContext";
import { getAuthToken, clearAuthToken, getSessionInfo } from "../lib/api";

export interface ProjectGroup {
  id: string;
  name: string;
  environment: "production" | "staging" | "development" | "edge";
  color: string;
  description: string;
  created_at: number;
  service_count: number;
  healthy_count: number;
  warning_count: number;
  critical_count: number;
  maintenance_count: number;
  avg_uptime: number;
  avg_latency: number;
  status: string;
}

interface StatusSettings {
  page_title: string;
  page_description: string;
  announcement_banner: string;
  announcement_type: "none" | "info" | "warning" | "critical";
  show_sla: boolean;
  show_incidents: boolean;
  footer_text: string;
  support_url: string;
  accent_color?: string;
}

interface AdvancedSettings {
  default_poll_interval: string;
  default_timeout: string;
  max_retries: string;
  resend_interval: string;
  ssl_warning_days: string;
  ignore_ssl_errors: boolean;
  default_http_method: string;
  user_agent: string;
  follow_redirects: boolean;
  accepted_status_codes: string;
  telemetry_retention_days: string;
}

export default function SettingsPage() {
  const toast = useToast();
  const navigate = useNavigate();

  const handleOperatorSignOut = () => {
    clearAuthToken();
    toast.info("Signed out of Operator Console. Session terminated.");
    navigate("/");
  };
  const [activeTab, setActiveTab] = useState<
    "status" | "groups" | "badges" | "advanced" | "alerts" | "subscribers" | "maintenance" | "security"
  >("status");

  // Status Page Configuration (Uptime Kuma Style)
  const [statusSettings, setStatusSettings] = useState<StatusSettings>({
    page_title: "Crystal Heimdall",
    page_description: "Continuous Multi-Point Health Monitoring & Real-Time Incident Status",
    announcement_banner: "All core systems nominal across all regions.",
    announcement_type: "info",
    show_sla: true,
    show_incidents: true,
    footer_text: "Crystal Studio Labs • Autonomous Reliability Sentinel",
    support_url: "https://github.com/Crystal-Studio-Labs",
    accent_color: "emerald",
  });
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);

  // Uptime Kuma Advanced Engine Settings
  const [advancedSettings, setAdvancedSettings] = useState<AdvancedSettings>({
    default_poll_interval: "60",
    default_timeout: "10",
    max_retries: "2",
    resend_interval: "5",
    ssl_warning_days: "30",
    ignore_ssl_errors: false,
    default_http_method: "GET",
    user_agent: "Crystal-Heimdall/2.0 (+https://github.com/Crystal-Studio-Labs)",
    follow_redirects: true,
    accepted_status_codes: "200-299, 301, 302",
    telemetry_retention_days: "30",
  });
  const [isSavingAdvanced, setIsSavingAdvanced] = useState(false);
  const [isPurging, setIsPurging] = useState(false);

  // Dynamic Project & Environment Groups State
  const [groups, setGroups] = useState<ProjectGroup[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ProjectGroup | null>(null);
  const [groupForm, setGroupForm] = useState<{
    name: string;
    environment: "production" | "staging" | "development" | "edge";
    color: string;
    description: string;
  }>({
    name: "",
    environment: "production",
    color: "#06b6d4",
    description: "",
  });
  const [isSavingGroup, setIsSavingGroup] = useState(false);

  // Dynamic Badges Hub State
  const [allServices, setAllServices] = useState<{ id: string; name: string; group_name?: string }[]>([]);
  const [badgeScope, setBadgeScope] = useState<"fleet" | "group" | "service">("fleet");
  const [selectedBadgeGroup, setSelectedBadgeGroup] = useState<string>("Production");
  const [selectedBadgeService, setSelectedBadgeService] = useState<string>("");
  const [badgeMetric, setBadgeMetric] = useState<"status" | "uptime" | "latency">("status");
  const [badgeCustomLabel, setBadgeCustomLabel] = useState<string>("");
  const [badgeRedirectUrl, setBadgeRedirectUrl] = useState<string>("https://crystal-heimdall.vercel.app/");
  const [badgeStyle, setBadgeStyle] = useState<"flat-square" | "pill" | "flat">("flat-square");
  const [badgePulse, setBadgePulse] = useState<boolean>(true);
  const [badgeColor, setBadgeColor] = useState<string>("");

  const fetchGroups = async () => {
    setIsLoadingGroups(true);
    try {
      const res = await fetch("/api/v1/groups");
      const data = await res.json();
      if (data && data.groups && Array.isArray(data.groups)) {
        setGroups(data.groups);
        if (data.groups.length > 0) {
          setSelectedBadgeGroup((prev) => {
            const exists = data.groups.some((g: any) => g.name === prev);
            return exists ? prev : data.groups[0].name;
          });
        }
      }
    } catch (err) {
      console.error("Failed to fetch groups", err);
    } finally {
      setIsLoadingGroups(false);
    }
  };

  const fetchServicesForBadges = async () => {
    try {
      const res = await fetch("/api/v1/services");
      const data = await res.json();
      const list = data?.services || (Array.isArray(data) ? data : []);
      if (Array.isArray(list) && list.length > 0) {
        setAllServices(list);
        setSelectedBadgeService((prev) => {
          const exists = list.some((s: any) => s.id === prev);
          const nextId = exists ? prev : list[0].id;
          return nextId;
        });
      }
    } catch (err) {
      console.error("Failed to fetch services for badges", err);
    }
  };

  // Synchronize badge state whenever active tab changes to badges
  useEffect(() => {
    if (activeTab === "badges") {
      fetchGroups();
      fetchServicesForBadges();
    }
  }, [activeTab]);

  // Keep selectedBadgeService synchronized whenever allServices updates
  useEffect(() => {
    if (allServices.length > 0) {
      const isValid = selectedBadgeService && allServices.some((s) => s.id === selectedBadgeService);
      if (!isValid) {
        const firstId = allServices[0].id;
        setSelectedBadgeService(firstId);
        if (badgeScope === "service") {
          setBadgeRedirectUrl(`https://crystal-heimdall.vercel.app/service/${firstId}`);
        }
      }
    }
  }, [allServices, badgeScope, selectedBadgeService]);

  // Keep selectedBadgeGroup synchronized whenever groups update
  useEffect(() => {
    if (groups.length > 0) {
      const isValid = selectedBadgeGroup && groups.some((g) => g.name === selectedBadgeGroup);
      if (!isValid) {
        setSelectedBadgeGroup(groups[0].name);
      }
    }
  }, [groups, selectedBadgeGroup]);

  const handleScopeChange = (newScope: "fleet" | "group" | "service") => {
    setBadgeScope(newScope);
    if (newScope === "service") {
      const activeSvcId = (selectedBadgeService && allServices.some((s) => s.id === selectedBadgeService))
        ? selectedBadgeService
        : (allServices[0]?.id || "");
      if (activeSvcId) {
        setSelectedBadgeService(activeSvcId);
        setBadgeRedirectUrl(`https://crystal-heimdall.vercel.app/service/${activeSvcId}`);
      } else {
        setBadgeRedirectUrl("https://crystal-heimdall.vercel.app/");
      }
    } else if (newScope === "group") {
      const activeGroup = (selectedBadgeGroup && groups.some((g) => g.name === selectedBadgeGroup))
        ? selectedBadgeGroup
        : (groups[0]?.name || "Production");
      setSelectedBadgeGroup(activeGroup);
      setBadgeRedirectUrl("https://crystal-heimdall.vercel.app/");
    } else {
      setBadgeRedirectUrl("https://crystal-heimdall.vercel.app/");
    }
  };

  const handleSelectBadgeService = (svcId: string) => {
    setSelectedBadgeService(svcId);
    if (svcId) {
      setBadgeRedirectUrl(`https://crystal-heimdall.vercel.app/service/${svcId}`);
    }
  };

  const handleSelectBadgeGroup = (groupName: string) => {
    setSelectedBadgeGroup(groupName);
  };

  const handleOpenCreateGroup = () => {
    setEditingGroup(null);
    setGroupForm({
      name: "",
      environment: "production",
      color: "#06b6d4",
      description: "",
    });
    setIsGroupModalOpen(true);
  };

  const handleOpenEditGroup = (g: ProjectGroup) => {
    setEditingGroup(g);
    setGroupForm({
      name: g.name,
      environment: g.environment || "production",
      color: g.color || "#06b6d4",
      description: g.description || "",
    });
    setIsGroupModalOpen(true);
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = groupForm.name.trim();
    if (!trimmed) {
      toast.error("Group name is required");
      return;
    }
    setIsSavingGroup(true);
    try {
      const isEdit = Boolean(editingGroup);
      const url = isEdit ? `/api/v1/groups/${editingGroup!.id}` : "/api/v1/groups";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(groupForm),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(isEdit ? `Group '${trimmed}' updated successfully!` : `Group '${trimmed}' created!`);
        setIsGroupModalOpen(false);
        fetchGroups();
      } else {
        toast.error(data.error || "Failed to save project group");
      }
    } catch (err: any) {
      toast.error(err.message || "Network error saving project group");
    } finally {
      setIsSavingGroup(false);
    }
  };

  const handleDeleteGroup = async (g: ProjectGroup) => {
    if (g.name.toLowerCase() === "production" && groups.length <= 1) {
      toast.error("Cannot delete the default Production group.");
      return;
    }
    if (!window.confirm(`Are you sure you want to delete group '${g.name}'? All member services will be reassigned to 'Production'.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/v1/groups/${g.id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || `Group '${g.name}' deleted.`);
        fetchGroups();
      } else {
        toast.error(data.error || "Failed to delete group");
      }
    } catch {
      toast.error("Network error deleting group");
    }
  };

  // Load Status Page & Advanced settings from server
  useEffect(() => {
    fetchGroups();
    fetchServicesForBadges();

    fetch("/api/v1/status/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data && data.settings) {
          const s = data.settings;
          setStatusSettings({
            page_title: s.page_title || "Crystal Heimdall",
            page_description: s.page_description || "Continuous Multi-Point Health Monitoring & Real-Time Incident Status",
            announcement_banner: s.announcement_banner || "",
            announcement_type: (s.announcement_type as any) || "info",
            show_sla: s.show_sla === undefined ? true : (s.show_sla === "true" || s.show_sla === true),
            show_incidents: s.show_incidents === undefined ? true : (s.show_incidents === "true" || s.show_incidents === true),
            footer_text: s.footer_text || "Crystal Studio Labs • Autonomous Reliability Sentinel",
            support_url: s.support_url || "https://github.com/Crystal-Studio-Labs",
            accent_color: s.accent_color || "emerald",
          });

          setAdvancedSettings({
            default_poll_interval: s.default_poll_interval || "60",
            default_timeout: s.default_timeout || "10",
            max_retries: s.max_retries || "2",
            resend_interval: s.resend_interval || "5",
            ssl_warning_days: s.ssl_warning_days || "30",
            ignore_ssl_errors: s.ignore_ssl_errors === "true" || s.ignore_ssl_errors === true,
            default_http_method: s.default_http_method || "GET",
            user_agent: s.user_agent || "Crystal-Heimdall/2.0 (+https://github.com/Crystal-Studio-Labs)",
            follow_redirects: s.follow_redirects === "true" || s.follow_redirects === true || s.follow_redirects === undefined,
            accepted_status_codes: s.accepted_status_codes || "200-299, 301, 302",
            telemetry_retention_days: s.telemetry_retention_days || "30",
          });
        }
      })
      .catch(() => {})
      .finally(() => setIsLoadingStatus(false));
  }, []);

  const handleSaveStatusSettings = async () => {
    setIsSavingStatus(true);
    try {
      const res = await fetch("/api/v1/status/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...statusSettings,
          show_sla: String(statusSettings.show_sla),
          show_incidents: String(statusSettings.show_incidents),
        }),
      });

      if (res.ok) {
        toast.success("Status page settings updated successfully!");
      } else {
        toast.error("Failed to save settings");
      }
    } catch {
      toast.error("Network error while saving settings");
    } finally {
      setIsSavingStatus(false);
    }
  };

  const handleSaveAdvancedSettings = async () => {
    setIsSavingAdvanced(true);
    try {
      const res = await fetch("/api/v1/status/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...advancedSettings,
          ignore_ssl_errors: String(advancedSettings.ignore_ssl_errors),
          follow_redirects: String(advancedSettings.follow_redirects),
        }),
      });

      if (res.ok) {
        toast.success("Uptime Kuma advanced configuration saved!");
      } else {
        toast.error("Failed to save advanced settings");
      }
    } catch {
      toast.error("Network error while saving advanced settings");
    } finally {
      setIsSavingAdvanced(false);
    }
  };

  const handlePurgeAction = async (action: string, label: string) => {
    setIsPurging(true);
    try {
      const res = await fetch("/api/v1/status/purge-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || `${label} executed nominal!`);
      } else {
        toast.error(data.error || "Failed to execute purge action");
      }
    } catch {
      toast.error("Network error executing maintenance action");
    } finally {
      setIsPurging(false);
    }
  };

  // Discord State
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState(
    localStorage.getItem("heimdall_discord_webhook") || ""
  );
  const [showDiscord, setShowDiscord] = useState(false);
  const [discordTesting, setDiscordTesting] = useState(false);
  const [discordStatus, setDiscordStatus] = useState<string | null>(null);

  // Telegram State
  const [telegramToken, setTelegramToken] = useState(
    localStorage.getItem("heimdall_telegram_token") || ""
  );
  const [telegramChatId, setTelegramChatId] = useState(
    localStorage.getItem("heimdall_telegram_chat_id") || ""
  );
  const [showTelegramToken, setShowTelegramToken] = useState(false);
  const [telegramTesting, setTelegramTesting] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<string | null>(null);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success("Snippet copied to clipboard");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleTestDiscord = async () => {
    if (!discordWebhookUrl.trim()) {
      setDiscordStatus("Please enter a Discord Webhook URL first.");
      toast.error("Please enter a Discord Webhook URL");
      return;
    }
    setDiscordTesting(true);
    setDiscordStatus(null);
    try {
      localStorage.setItem("heimdall_discord_webhook", discordWebhookUrl.trim());
      const res = await fetch("/api/v1/channels/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "discord", webhookUrl: discordWebhookUrl.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setDiscordStatus("✅ Test embed dispatched successfully to your Discord channel!");
        toast.success("Test embed sent to Discord!");
      } else {
        setDiscordStatus(`❌ Dispatch failed: ${data.error || "Unknown error"}`);
        toast.error("Discord dispatch failed");
      }
    } catch (err: any) {
      setDiscordStatus(`❌ Network error: ${err.message}`);
      toast.error(err.message);
    } finally {
      setDiscordTesting(false);
    }
  };

  const handleTestTelegram = async () => {
    if (!telegramToken.trim() || !telegramChatId.trim()) {
      setTelegramStatus("Please enter both Telegram Bot Token and Chat ID.");
      toast.error("Please enter Bot Token and Chat ID");
      return;
    }
    setTelegramTesting(true);
    setTelegramStatus(null);
    try {
      localStorage.setItem("heimdall_telegram_token", telegramToken.trim());
      localStorage.setItem("heimdall_telegram_chat_id", telegramChatId.trim());
      const res = await fetch("/api/v1/channels/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "telegram",
          token: telegramToken.trim(),
          chatId: telegramChatId.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTelegramStatus("✅ Test alert sent to Telegram chat!");
        toast.success("Test alert sent to Telegram!");
      } else {
        setTelegramStatus(`❌ Dispatch failed: ${data.error || "Unknown error"}`);
        toast.error("Telegram dispatch failed");
      }
    } catch (err: any) {
      setTelegramStatus(`❌ Network error: ${err.message}`);
      toast.error(err.message);
    } finally {
      setTelegramTesting(false);
    }
  };

  // Generic Webhook State
  const [genericWebhookUrl, setGenericWebhookUrl] = useState(
    localStorage.getItem("heimdall_generic_webhook") || ""
  );
  const [genericTesting, setGenericTesting] = useState(false);
  const [genericStatus, setGenericStatus] = useState<string | null>(null);

  const handleTestGenericWebhook = async () => {
    if (!genericWebhookUrl.trim()) {
      setGenericStatus("Please enter a Generic Webhook URL first.");
      toast.error("Please enter a Generic Webhook URL");
      return;
    }
    setGenericTesting(true);
    setGenericStatus(null);
    try {
      localStorage.setItem("heimdall_generic_webhook", genericWebhookUrl.trim());
      const res = await fetch("/api/v1/channels/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "generic", webhookUrl: genericWebhookUrl.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setGenericStatus("✅ Test alert successfully dispatched to generic webhook endpoint!");
        toast.success("Test payload delivered to generic webhook!");
      } else {
        setGenericStatus(`❌ Dispatch failed: ${data.message || data.error || "Unknown error"}`);
        toast.error("Generic webhook dispatch failed");
      }
    } catch (err: any) {
      setGenericStatus(`❌ Network error: ${err.message}`);
      toast.error(err.message);
    } finally {
      setGenericTesting(false);
    }
  };

  // --- FEATURE: In-Browser Webhook Conduit & Alert Dispatch Simulator ---
  const [simScenario, setSimScenario] = useState<"critical" | "warning" | "info">("critical");
  const [simTarget, setSimTarget] = useState<"discord" | "telegram" | "generic">("generic");
  const [simServiceName, setSimServiceName] = useState("Crystal Auth Gateway");
  const [simCustomTitle, setSimCustomTitle] = useState("");
  const [simCustomMessage, setSimCustomMessage] = useState("");
  const [simIsRunning, setSimIsRunning] = useState(false);
  const [simResult, setSimResult] = useState<{
    success: boolean;
    message: string;
    statusCode?: number;
    latencyMs?: number;
    simulatedPayload?: any;
  } | null>(null);

  const handleRunSimulation = async () => {
    setSimIsRunning(true);
    setSimResult(null);
    try {
      const body: any = {
        type: simTarget,
        severity: simScenario,
        serviceName: simServiceName.trim() || "Crystal Sentinel",
        title: simCustomTitle.trim() || undefined,
        message: simCustomMessage.trim() || undefined,
      };

      if (simTarget === "discord") {
        if (!discordWebhookUrl.trim()) {
          toast.error("Please configure a Discord Webhook URL first");
          setSimIsRunning(false);
          return;
        }
        body.webhookUrl = discordWebhookUrl.trim();
      } else if (simTarget === "telegram") {
        if (!telegramToken.trim() || !telegramChatId.trim()) {
          toast.error("Please configure Telegram Bot Token and Chat ID first");
          setSimIsRunning(false);
          return;
        }
        body.token = telegramToken.trim();
        body.chatId = telegramChatId.trim();
      } else {
        if (!genericWebhookUrl.trim()) {
          toast.error("Please configure a Generic Webhook URL first");
          setSimIsRunning(false);
          return;
        }
        body.webhookUrl = genericWebhookUrl.trim();
      }

      const res = await fetch("/api/v1/channels/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      setSimResult(data);
      if (data.success) {
        toast.success(`Simulation delivered via ${simTarget.toUpperCase()} in ${data.latencyMs || 0}ms`);
      } else {
        toast.error(`Simulation failed: ${data.message || data.error}`);
      }
    } catch (err: any) {
      setSimResult({
        success: false,
        message: err.message,
      });
      toast.error(err.message);
    } finally {
      setSimIsRunning(false);
    }
  };

  // --- FEATURE: Subscribers Management ---
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [subscriberStats, setSubscriberStats] = useState({ total: 0, emailCount: 0, webhookCount: 0 });
  const [isLoadingSubscribers, setIsLoadingSubscribers] = useState(false);

  const fetchSubscribers = async () => {
    setIsLoadingSubscribers(true);
    try {
      const token = getAuthToken();
      const res = await fetch("/api/v1/subscribers", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setSubscribers(data.subscribers || []);
        setSubscriberStats({
          total: data.total || 0,
          emailCount: data.emailCount || 0,
          webhookCount: data.webhookCount || 0,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingSubscribers(false);
    }
  };

  const handleDeleteSubscriber = async (id: string) => {
    if (!confirm("Revoke this subscription? The destination will no longer receive outage alerts.")) return;
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/v1/subscribers/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        toast.success("Subscriber successfully removed");
        fetchSubscribers();
      } else {
        toast.error("Failed to delete subscriber");
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // --- FEATURE: Scheduled Maintenance Engine ---
  const [maintenanceWindows, setMaintenanceWindows] = useState<any[]>([]);
  const [isLoadingMaintenance, setIsLoadingMaintenance] = useState(false);
  const [isMaintModalOpen, setIsMaintModalOpen] = useState(false);
  const [maintForm, setMaintForm] = useState({
    title: "",
    description: "",
    startTime: "",
    endTime: "",
    affectedServices: [] as string[],
    status: "scheduled",
  });

  const fetchMaintenance = async () => {
    setIsLoadingMaintenance(true);
    try {
      const res = await fetch("/api/v1/maintenance?includePast=true");
      if (res.ok) {
        const data = await res.json();
        const combined = [...(data.active || []), ...(data.upcoming || []), ...(data.past || [])];
        setMaintenanceWindows(combined);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingMaintenance(false);
    }
  };

  const handleCreateMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!maintForm.title.trim()) {
      toast.error("Please enter a maintenance window title");
      return;
    }
    const startMs = new Date(maintForm.startTime).getTime();
    const endMs = new Date(maintForm.endTime).getTime();
    if (!startMs || !endMs || endMs <= startMs) {
      toast.error("End time must be after start time");
      return;
    }

    try {
      const token = getAuthToken();
      const res = await fetch("/api/v1/maintenance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: maintForm.title.trim(),
          description: maintForm.description.trim(),
          startTime: startMs,
          endTime: endMs,
          affectedServices: maintForm.affectedServices,
          status: maintForm.status,
        }),
      });

      if (res.ok) {
        toast.success("Maintenance window scheduled successfully");
        setIsMaintModalOpen(false);
        setMaintForm({
          title: "",
          description: "",
          startTime: "",
          endTime: "",
          affectedServices: [],
          status: "scheduled",
        });
        fetchMaintenance();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to schedule maintenance window");
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleUpdateMaintenanceStatus = async (id: string, status: string) => {
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/v1/maintenance/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        toast.success(`Maintenance window status updated to ${status.toUpperCase()}`);
        fetchMaintenance();
      } else {
        toast.error("Failed to update maintenance status");
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteMaintenance = async (id: string) => {
    if (!confirm("Permanently delete this scheduled maintenance window?")) return;
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/v1/maintenance/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        toast.success("Maintenance window deleted");
        fetchMaintenance();
      } else {
        toast.error("Failed to delete maintenance window");
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Initial fetch for subscribers & maintenance when tabs are clicked
  useEffect(() => {
    if (activeTab === "subscribers") fetchSubscribers();
    if (activeTab === "maintenance") fetchMaintenance();
  }, [activeTab]);


  return (
    <div className="min-h-screen bg-[#070a0f] text-zinc-100 flex flex-col font-mono relative overflow-hidden pb-24">
      <SEO 
        title="Control Deck Settings // Crystal Heimdall"
        description="Configure public status customization, Uptime Kuma poller defaults, TLS/SSL matrices, notification relays, and telemetry lifecycle."
        canonicalPath="/dashboard/settings"
        noIndex={true}
      />
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b-2 border-zinc-800">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-xs text-cyan-400 font-bold">
              <Sliders className="w-3.5 h-3.5" />
              <span>[CONFIGURATION & STATUS PAGE SETTINGS]</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase text-white tracking-tight">
              Control Deck Settings
            </h1>
            <p className="text-xs text-zinc-400 font-sans">
              Manage public status customization, project groups, embeddable shields, uptime engine, and notification relays.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleOperatorSignOut}
              className="px-4 py-2 bg-rose-950/80 hover:bg-rose-900 border-2 border-rose-600 hover:border-rose-500 text-rose-200 font-mono font-bold text-xs uppercase flex items-center gap-2 shadow-[3px_3px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition"
              title="Terminate authenticated operator session and return to public status deck"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
              <span>[ SIGN OUT / LOGOUT ]</span>
            </button>
          </div>
        </div>

        {/* TOP TAB CONTROLS (INDUSTRIAL BRUTALIST ROCKER TABS) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {[
            { id: "status", label: "[01] STATUS" },
            { id: "groups", label: "[02] GROUPS" },
            { id: "badges", label: "[03] BADGES" },
            { id: "advanced", label: "[04] ENGINE" },
            { id: "alerts", label: "[05] DISPATCH" },
            { id: "subscribers", label: "[06] SUBSCRIBERS" },
            { id: "maintenance", label: "[07] MAINTENANCE" },
            { id: "security", label: "[08] SECURITY" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`p-2.5 text-[11px] font-bold font-mono border-2 transition-all text-center uppercase tracking-tight flex items-center justify-center ${
                activeTab === tab.id
                  ? "bg-zinc-800 text-emerald-300 border-emerald-400 shadow-[3px_3px_0px_#000]"
                  : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB 1: STATUS PAGE EDITOR (UPTIME KUMA STYLE) */}
        {activeTab === "status" && (
          <div className="space-y-6">
            <div className="bg-[#0b0f17] border-2 border-zinc-700 shadow-[4px_4px_0px_#000] p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-zinc-800 pb-4">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-white uppercase">
                    Status Page Customizer (Uptime Kuma Style)
                  </h2>
                  <p className="text-xs text-zinc-400 font-sans">
                    Configure the title, description, maintenance announcement banner, SLA display, and footer.
                  </p>
                </div>
                <button
                  onClick={handleSaveStatusSettings}
                  disabled={isSavingStatus}
                  className="px-6 py-2.5 btn-primary text-xs flex items-center justify-center gap-2 self-start sm:self-auto"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingStatus ? "Saving..." : "[ SAVE SETTINGS ]"}</span>
                </button>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Field 1: Page Title */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase block">
                    STATUS PAGE TITLE
                  </label>
                  <input
                    type="text"
                    value={statusSettings.page_title}
                    onChange={(e) => setStatusSettings({ ...statusSettings, page_title: e.target.value })}
                    placeholder="Uptime Tracker For Crystal Studio Labs"
                    className="w-full p-2.5 bg-black border-2 border-zinc-700 text-white font-mono text-xs focus:border-cyan-400 outline-none"
                  />
                  <span className="text-[10px] text-zinc-500">Displayed in browser title bar and main status header</span>
                </div>

                {/* Field 2: Subtitle / Description */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase block">
                    STATUS PAGE SUBTITLE
                  </label>
                  <input
                    type="text"
                    value={statusSettings.page_description}
                    onChange={(e) => setStatusSettings({ ...statusSettings, page_description: e.target.value })}
                    placeholder="Continuous Multi-Point Health Monitoring & Incident Status"
                    className="w-full p-2.5 bg-black border-2 border-zinc-700 text-white font-mono text-xs focus:border-cyan-400 outline-none"
                  />
                  <span className="text-[10px] text-zinc-500">Subtitle displayed under the hero banner</span>
                </div>
              </div>

              {/* BRAND ACCENT COLOR PALETTE */}
              <div className="p-5 bg-black border-2 border-zinc-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase">// BRAND ACCENT PALETTE //</h3>
                    <p className="text-[11px] text-zinc-400 font-sans">
                      Select your organization's signature cyber-industrial accent glow and highlights.
                    </p>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    CURRENT: {(statusSettings.accent_color || "emerald").toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                  {[
                    { id: "emerald", label: "EMERALD", hex: "#10b981", swatch: "bg-emerald-500", border: "border-emerald-400 text-emerald-300" },
                    { id: "cyan", label: "ELECTRIC CYAN", hex: "#06b6d4", swatch: "bg-cyan-500", border: "border-cyan-400 text-cyan-300" },
                    { id: "amber", label: "AMBER HAZARD", hex: "#f59e0b", swatch: "bg-amber-500", border: "border-amber-400 text-amber-300" },
                    { id: "violet", label: "CYBER VIOLET", hex: "#8b5cf6", swatch: "bg-purple-500", border: "border-purple-400 text-purple-300" },
                    { id: "rose", label: "NEON ROSE", hex: "#f43f5e", swatch: "bg-rose-500", border: "border-rose-400 text-rose-300" },
                  ].map((color) => (
                    <button
                      key={color.id}
                      type="button"
                      onClick={() => setStatusSettings({ ...statusSettings, accent_color: color.id })}
                      className={`p-2.5 border-2 text-xs font-mono font-bold flex items-center justify-center gap-2 transition ${
                        (statusSettings.accent_color || "emerald") === color.id
                          ? `${color.border} bg-zinc-900 shadow-[2px_2px_0px_#000]`
                          : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white hover:border-zinc-700"
                      }`}
                    >
                      <span className={`w-3 h-3 ${color.swatch} inline-block shrink-0`} />
                      <span className="text-[10px] uppercase">{color.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ANNOUNCEMENT BANNER SECTION */}
              <div className="p-5 bg-black border-2 border-zinc-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase">// LIVE ANNOUNCEMENT BANNER //</h3>
                    <p className="text-[11px] text-zinc-400 font-sans">
                      Display scheduled maintenance, emergency broadcast, or operational notice.
                    </p>
                  </div>

                  {/* Banner Type Selector */}
                  <div className="flex border border-zinc-700 bg-zinc-900 p-0.5 text-[10px]">
                    {[
                      { id: "none", label: "OFF" },
                      { id: "info", label: "INFO" },
                      { id: "warning", label: "WARNING" },
                      { id: "critical", label: "OUTAGE" },
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => setStatusSettings({ ...statusSettings, announcement_type: mode.id as any })}
                        className={`px-3 py-1 font-bold uppercase transition ${
                          statusSettings.announcement_type === mode.id
                            ? mode.id === "critical"
                              ? "bg-rose-600 text-white"
                              : mode.id === "warning"
                              ? "bg-amber-500 text-black"
                              : mode.id === "info"
                              ? "bg-cyan-400 text-black"
                              : "bg-zinc-700 text-white"
                            : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <textarea
                    rows={3}
                    value={statusSettings.announcement_banner}
                    onChange={(e) => setStatusSettings({ ...statusSettings, announcement_banner: e.target.value })}
                    placeholder="e.g. All core systems nominal. Scheduled database index maintenance completed with zero downtime."
                    className="w-full p-2.5 bg-zinc-950 border-2 border-zinc-700 text-white font-mono text-xs focus:border-cyan-400 outline-none resize-none"
                  />
                </div>

                {/* Live Preview Box */}
                {statusSettings.announcement_type !== "none" && statusSettings.announcement_banner && (
                  <div className="space-y-1 pt-2">
                    <span className="text-[10px] text-zinc-500 uppercase font-bold">LIVE BANNER PREVIEW:</span>
                    <div
                      className={`p-3.5 border-2 flex items-start gap-3 ${
                        statusSettings.announcement_type === "critical"
                          ? "bg-rose-950/40 border-rose-600 text-rose-300"
                          : statusSettings.announcement_type === "warning"
                          ? "bg-amber-950/40 border-amber-500 text-amber-300"
                          : "bg-cyan-950/40 border-cyan-500 text-cyan-300"
                      }`}
                    >
                      {statusSettings.announcement_type === "critical" ? (
                        <Flame className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                      ) : statusSettings.announcement_type === "warning" ? (
                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-cyan-400 mt-0.5" />
                      )}
                      <div>
                        <span className="font-bold text-[11px] uppercase mr-2">
                          [{statusSettings.announcement_type.toUpperCase()} NOTICE]:
                        </span>
                        <span className="text-xs">{statusSettings.announcement_banner}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* TOGGLES & DISPLAY CONTROLS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setStatusSettings({ ...statusSettings, show_sla: !statusSettings.show_sla })}
                  className={`p-4 border-2 flex items-center justify-between text-left transition shadow-[2px_2px_0px_#000] cursor-pointer ${
                    statusSettings.show_sla
                      ? "bg-emerald-950/20 border-emerald-500 text-emerald-300"
                      : "bg-zinc-950 border-zinc-800 hover:border-zinc-700 text-zinc-400"
                  }`}
                >
                  <div className="space-y-0.5 min-w-0">
                    <span className="text-xs font-bold text-white block uppercase">Display 30-Day Fleet SLA</span>
                    <span className="text-[11px] text-zinc-400 font-sans block">Show calculated uptime percentage on public page</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className={`text-[10px] font-mono font-bold px-2 py-1 border uppercase tracking-wider ${
                      statusSettings.show_sla
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                        : "bg-zinc-900 text-zinc-500 border-zinc-700"
                    }`}>
                      {statusSettings.show_sla ? "[ ENABLED ]" : "[ DISABLED ]"}
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setStatusSettings({ ...statusSettings, show_incidents: !statusSettings.show_incidents })}
                  className={`p-4 border-2 flex items-center justify-between text-left transition shadow-[2px_2px_0px_#000] cursor-pointer ${
                    statusSettings.show_incidents
                      ? "bg-emerald-950/20 border-emerald-500 text-emerald-300"
                      : "bg-zinc-950 border-zinc-800 hover:border-zinc-700 text-zinc-400"
                  }`}
                >
                  <div className="space-y-0.5 min-w-0">
                    <span className="text-xs font-bold text-white block uppercase">Display Incident History</span>
                    <span className="text-[11px] text-zinc-400 font-sans block">Show recent incidents and outage ledger</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className={`text-[10px] font-mono font-bold px-2 py-1 border uppercase tracking-wider ${
                      statusSettings.show_incidents
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]"
                        : "bg-zinc-900 text-zinc-500 border-zinc-700"
                    }`}>
                      {statusSettings.show_incidents ? "[ ENABLED ]" : "[ DISABLED ]"}
                    </span>
                  </div>
                </button>
              </div>

              {/* FOOTER & SUPPORT URL */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase block">
                    CUSTOM FOOTER TEXT
                  </label>
                  <input
                    type="text"
                    value={statusSettings.footer_text}
                    onChange={(e) => setStatusSettings({ ...statusSettings, footer_text: e.target.value })}
                    placeholder="Crystal Studio Labs • Autonomous Reliability Sentinel"
                    className="w-full p-2.5 bg-black border-2 border-zinc-700 text-white font-mono text-xs focus:border-cyan-400 outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-400 uppercase block">
                    ORGANIZATION SUPPORT URL
                  </label>
                  <input
                    type="text"
                    value={statusSettings.support_url}
                    onChange={(e) => setStatusSettings({ ...statusSettings, support_url: e.target.value })}
                    placeholder="https://github.com/Crystal-Studio-Labs"
                    className="w-full p-2.5 bg-black border-2 border-zinc-700 text-white font-mono text-xs focus:border-cyan-400 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: GROUPS & ENVIRONMENTS */}
        {activeTab === "groups" && (
          <div className="space-y-6">
            <div className="bg-[#0b0f17] border-2 border-zinc-700 shadow-[4px_4px_0px_#000] p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-zinc-800 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2 text-xs text-cyan-400 font-bold">
                    <Layers className="w-4 h-4 text-cyan-400" />
                    <span>[PROJECT & ENVIRONMENT NAMESPACES]</span>
                  </div>
                  <h2 className="text-base sm:text-lg font-black text-white uppercase">
                    Project & Environment Groups
                  </h2>
                  <p className="text-xs text-zinc-400 font-sans">
                    Configure custom environments, project clusters, and microservice tiers. Group changes cascade dynamically to dashboard filters and SVG badges.
                  </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    onClick={fetchGroups}
                    disabled={isLoadingGroups}
                    className="p-2.5 bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white text-xs font-bold font-mono transition"
                    title="Refresh groups"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingGroups ? "animate-spin text-cyan-400" : ""}`} />
                  </button>

                  <button
                    onClick={handleOpenCreateGroup}
                    className="px-4 py-2.5 btn-primary text-xs flex items-center gap-2 shadow-[2px_2px_0px_#000]"
                  >
                    <Plus className="w-4 h-4" />
                    <span>[ + CREATE NEW GROUP ]</span>
                  </button>
                </div>
              </div>

              {/* Group Cards Grid */}
              {isLoadingGroups ? (
                <div className="p-12 text-center text-xs text-zinc-500 font-mono">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-cyan-400 mb-2" />
                  LOADING PROJECT GROUPS...
                </div>
              ) : groups.length === 0 ? (
                <div className="p-8 border-2 border-dashed border-zinc-800 text-center space-y-3">
                  <FolderPlus className="w-8 h-8 text-zinc-600 mx-auto" />
                  <p className="text-xs text-zinc-400">No project groups created yet.</p>
                  <button
                    onClick={handleOpenCreateGroup}
                    className="px-4 py-2 btn-primary text-xs"
                  >
                    [ CREATE FIRST GROUP ]
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groups.map((g) => {
                    const envColor =
                      g.environment === "production"
                        ? "text-emerald-400 border-emerald-500 bg-emerald-950/30"
                        : g.environment === "staging"
                        ? "text-fuchsia-400 border-fuchsia-500 bg-fuchsia-950/30"
                        : g.environment === "development"
                        ? "text-purple-400 border-purple-500 bg-purple-950/30"
                        : "text-cyan-400 border-cyan-500 bg-cyan-950/30";

                    return (
                      <div
                        key={g.id}
                        className="bg-black border-2 border-zinc-800 hover:border-zinc-700 transition flex flex-col justify-between shadow-[3px_3px_0px_#000] relative overflow-hidden"
                      >
                        {/* Accent line on top */}
                        <div
                          className="h-1.5 w-full"
                          style={{ backgroundColor: g.color || "#06b6d4" }}
                        />

                        <div className="p-4 space-y-3 flex-1">
                          {/* Card Header */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ backgroundColor: g.color || "#06b6d4" }}
                                />
                                <h3 className="font-black text-white text-sm uppercase truncate">
                                  {g.name}
                                </h3>
                              </div>
                              <span
                                className={`inline-block px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase border ${envColor}`}
                              >
                                {g.environment}
                              </span>
                            </div>

                            {/* Card Header Actions */}
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => handleOpenEditGroup(g)}
                                className="p-1.5 bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white text-xs transition"
                                title="Edit group name or properties"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteGroup(g)}
                                disabled={g.name.toLowerCase() === "production" && groups.length <= 1}
                                className={`p-1.5 bg-zinc-900 border border-zinc-700 text-xs transition ${
                                  g.name.toLowerCase() === "production" && groups.length <= 1
                                    ? "text-zinc-600 cursor-not-allowed"
                                    : "text-rose-400 hover:bg-rose-950/50 hover:border-rose-500"
                                }`}
                                title="Delete group"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Description */}
                          <p className="text-xs text-zinc-400 font-sans leading-relaxed line-clamp-2 min-h-[2rem]">
                            {g.description || "Active sentinel environment namespace."}
                          </p>

                          {/* Stats Grid */}
                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800 text-[11px] font-mono">
                            <div className="bg-zinc-950 p-2 border border-zinc-800/80">
                              <span className="text-zinc-500 block text-[9px] uppercase">TARGETS</span>
                              <span className="font-bold text-white text-xs">
                                {g.service_count} {g.service_count === 1 ? "Service" : "Services"}
                              </span>
                            </div>

                            <div className="bg-zinc-950 p-2 border border-zinc-800/80">
                              <span className="text-zinc-500 block text-[9px] uppercase">30D UPTIME</span>
                              <span
                                className={`font-bold text-xs ${
                                  g.avg_uptime >= 99.0
                                    ? "text-emerald-400"
                                    : g.avg_uptime >= 95.0
                                    ? "text-amber-400"
                                    : "text-rose-400"
                                }`}
                              >
                                {g.avg_uptime}%
                              </span>
                            </div>
                          </div>

                          {/* Live Target Status Pills */}
                          <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400">
                            <span className="flex items-center gap-1 text-emerald-400">
                              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                              {g.healthy_count} OK
                            </span>
                            {g.warning_count > 0 && (
                              <span className="flex items-center gap-1 text-amber-400">
                                <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
                                {g.warning_count} WARN
                              </span>
                            )}
                            {g.critical_count > 0 && (
                              <span className="flex items-center gap-1 text-rose-400">
                                <span className="w-1.5 h-1.5 bg-rose-400 rounded-full animate-pulse" />
                                {g.critical_count} DOWN
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Card Footer Button */}
                        <div className="p-3 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between gap-2">
                          <button
                            onClick={() => {
                              setBadgeScope("group");
                              setSelectedBadgeGroup(g.name);
                              setActiveTab("badges");
                            }}
                            className="w-full py-1.5 px-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-cyan-300 hover:text-cyan-200 text-[11px] font-bold uppercase font-mono flex items-center justify-center gap-1.5 transition"
                          >
                            <Shield className="w-3.5 h-3.5" />
                            <span>[ GET PROJECT BADGE ]</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: DYNAMIC SVG BADGES HUB */}
        {activeTab === "badges" && (
          <div className="space-y-6">
            <div className="bg-[#0b0f17] border-2 border-zinc-700 shadow-[4px_4px_0px_#000] p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-zinc-800 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2 text-xs text-emerald-400 font-bold">
                    <Shield className="w-4 h-4 text-emerald-400" />
                    <span>[EMBEDDABLE SVG STATUS SHIELDS & MARKDOWN GENERATOR]</span>
                  </div>
                  <h2 className="text-base sm:text-lg font-black text-white uppercase">
                    Dynamic SVG Badges Hub
                  </h2>
                  <p className="text-xs text-zinc-400 font-sans">
                    Generate real-time SVG status & uptime badges for individual projects, services, or the entire fleet. All badges natively hyperlink directly to <span className="text-emerald-300 font-mono">https://crystal-heimdall.vercel.app/</span> when clicked.
                  </p>
                </div>
              </div>

              {/* Badges Customizer Controls Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-black p-5 border-2 border-zinc-800">
                {/* Control 1: Target Scope */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-zinc-300 uppercase block font-mono">
                    // 1. SELECT BADGE SCOPE //
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: "fleet", label: "FLEET-WIDE" },
                      { id: "group", label: "BY PROJECT GROUP" },
                      { id: "service", label: "INDIVIDUAL SERVICE" },
                    ].map((scope) => (
                      <button
                        type="button"
                        key={scope.id}
                        onClick={() => handleScopeChange(scope.id as any)}
                        className={`p-2 text-[10px] font-bold font-mono border transition text-center uppercase ${
                          badgeScope === scope.id
                            ? "bg-cyan-950 border-cyan-400 text-cyan-300"
                            : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
                        }`}
                      >
                        {scope.label}
                      </button>
                    ))}
                  </div>

                  {/* Target Selector Dropdown if Project Group or Service */}
                  {badgeScope === "group" && (
                    <div className="pt-2">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase block font-mono mb-1">
                        Select Project Group:
                      </label>
                      <select
                        value={selectedBadgeGroup || (groups[0]?.name || "Production")}
                        onChange={(e) => handleSelectBadgeGroup(e.target.value)}
                        className="w-full p-2 bg-zinc-950 border border-zinc-700 text-white font-mono text-xs focus:border-cyan-400 outline-none"
                      >
                        {groups.length === 0 ? (
                          <option value="Production">Production (DEFAULT)</option>
                        ) : (
                          groups.map((g) => (
                            <option key={g.id} value={g.name}>
                              {g.name} ({g.environment.toUpperCase()} • {g.service_count} services)
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  )}

                  {badgeScope === "service" && (
                    <div className="pt-2">
                      <label className="text-[10px] font-bold text-zinc-400 uppercase block font-mono mb-1">
                        Select Monitored Service:
                      </label>
                      <select
                        value={selectedBadgeService || (allServices[0]?.id || "")}
                        onChange={(e) => handleSelectBadgeService(e.target.value)}
                        className="w-full p-2 bg-zinc-950 border border-zinc-700 text-white font-mono text-xs focus:border-cyan-400 outline-none"
                      >
                        {allServices.length === 0 ? (
                          <option value="">No services registered</option>
                        ) : (
                          allServices.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} [{s.group_name || "Production"}]
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  )}
                </div>

                {/* Control 2: Metric Type & Custom Label */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-zinc-300 uppercase block font-mono">
                    // 2. METRIC & CUSTOM LABEL //
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: "status", label: "STATUS (ONLINE/DOWN)" },
                      { id: "uptime", label: "UPTIME (30-DAY %)" },
                      { id: "latency", label: "LATENCY (MS)" },
                    ].map((m) => (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => setBadgeMetric(m.id as any)}
                        className={`p-2 text-[10px] font-bold font-mono border transition text-center uppercase ${
                          badgeMetric === m.id
                            ? "bg-emerald-950 border-emerald-400 text-emerald-300"
                            : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  <div className="pt-2">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase block font-mono mb-1">
                      Custom Label Override (Optional):
                    </label>
                    <input
                      type="text"
                      placeholder={
                        badgeScope === "fleet"
                          ? "FLEET STATUS"
                          : badgeScope === "group"
                          ? selectedBadgeGroup || "PROJECT STATUS"
                          : "SERVICE STATUS"
                      }
                      value={badgeCustomLabel}
                      onChange={(e) => setBadgeCustomLabel(e.target.value)}
                      className="w-full p-2 bg-zinc-950 border border-zinc-700 text-white font-mono text-xs focus:border-cyan-400 outline-none"
                    />
                  </div>
                </div>

                {/* Control 3: Badge Style & Pulse Radar Beacon */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-zinc-300 uppercase block font-mono">
                    // 3. BADGE STYLE & LIVE PULSE //
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: "flat-square", label: "FLAT-SQUARE" },
                      { id: "pill", label: "ROUNDED PILL" },
                      { id: "flat", label: "FLAT (CLASSIC)" },
                    ].map((s) => (
                      <button
                        type="button"
                        key={s.id}
                        onClick={() => setBadgeStyle(s.id as any)}
                        className={`p-2 text-[10px] font-bold font-mono border transition text-center uppercase ${
                          badgeStyle === s.id
                            ? "bg-purple-950 border-purple-400 text-purple-300"
                            : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>

                  <div className="pt-2 flex items-center justify-between p-2 bg-zinc-950 border border-zinc-800">
                    <span className="text-[10px] font-bold text-zinc-300 font-mono">
                      RADAR BEACON PULSE ANIMATION:
                    </span>
                    <button
                      type="button"
                      onClick={() => setBadgePulse(!badgePulse)}
                      className={`px-3 py-1 text-[10px] font-bold font-mono border transition uppercase ${
                        badgePulse
                          ? "bg-emerald-950 border-emerald-400 text-emerald-300"
                          : "bg-zinc-900 border-zinc-700 text-zinc-500"
                      }`}
                    >
                      {badgePulse ? "[ ENABLED (PULSING) ]" : "[ DISABLED ]"}
                    </button>
                  </div>
                </div>

                {/* Control 4: Custom Color Preset Override */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-zinc-300 uppercase block font-mono">
                    // 4. COLOR THEME OVERRIDE //
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {[
                      { id: "", label: "AUTO / DYNAMIC", color: "#10b981" },
                      { id: "emerald", label: "EMERALD", color: "#10b981" },
                      { id: "cyan", label: "CYAN", color: "#06b6d4" },
                      { id: "violet", label: "VIOLET", color: "#8b5cf6" },
                      { id: "amber", label: "AMBER", color: "#f59e0b" },
                      { id: "rose", label: "ROSE", color: "#ef4444" },
                    ].map((c) => (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => setBadgeColor(c.id)}
                        className={`p-1.5 text-[9px] font-bold font-mono border transition text-center uppercase flex items-center justify-center gap-1 ${
                          badgeColor === c.id
                            ? "border-white text-white bg-zinc-800 shadow-[2px_2px_0px_#fff]"
                            : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white"
                        }`}
                      >
                        <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                        <span>{c.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Control 5: Target Redirect URL (Span 2) */}
                <div className="md:col-span-2 space-y-1 pt-2 border-t border-zinc-800">
                  <label className="text-[11px] font-bold text-zinc-300 uppercase block font-mono">
                    // 3. ON-CLICK REDIRECT DESTINATION //
                  </label>
                  <input
                    type="url"
                    value={badgeRedirectUrl}
                    onChange={(e) => setBadgeRedirectUrl(e.target.value)}
                    placeholder="https://crystal-heimdall.vercel.app/"
                    className="w-full p-2 bg-zinc-950 border border-zinc-700 text-emerald-300 font-mono text-xs focus:border-cyan-400 outline-none"
                  />
                  <p className="text-[10px] text-zinc-500 font-mono">
                    [INTERACTIVE SVG EMBEDDING]: Clicking the SVG badge in any browser or markdown viewer triggers direct navigation to this URL.
                  </p>
                </div>
              </div>

              {/* Live Interactive Preview Card */}
              {(() => {
                const origin = typeof window !== "undefined" ? window.location.origin : "https://crystal-heimdall.vercel.app";
                const canonicalOrigin = typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1"
                  ? window.location.origin
                  : "https://crystal-heimdall.vercel.app";

                const effectiveServiceId = selectedBadgeService || (allServices.length > 0 ? allServices[0].id : "");
                const effectiveGroupName = selectedBadgeGroup || (groups.length > 0 ? groups[0].name : "Production");

                let path = "/api/v1/badges/fleet/status.svg";
                if (badgeScope === "group") {
                  path = `/api/v1/badges/project/${encodeURIComponent(effectiveGroupName)}/status.svg`;
                } else if (badgeScope === "service") {
                  path = effectiveServiceId
                    ? `/api/v1/badges/service/${encodeURIComponent(effectiveServiceId)}/status.svg`
                    : "/api/v1/badges/fleet/status.svg";
                }

                const matchedService = allServices.find((s) => s.id === effectiveServiceId);
                const displayLabel = badgeCustomLabel.trim() || (
                  badgeScope === "fleet" 
                    ? "Fleet Status" 
                    : badgeScope === "group" 
                    ? effectiveGroupName 
                    : (matchedService ? matchedService.name : "Service Status")
                );

                const params = new URLSearchParams();
                if (badgeMetric !== "status") params.set("metric", badgeMetric);
                if (badgeCustomLabel.trim()) params.set("label", badgeCustomLabel.trim());
                if (badgeStyle && badgeStyle !== "flat-square") params.set("style", badgeStyle);
                if (badgePulse) params.set("pulse", "true");
                if (badgeColor) params.set("color", badgeColor);

                const defaultRedirect = badgeScope === "service" && effectiveServiceId
                  ? `https://crystal-heimdall.vercel.app/service/${effectiveServiceId}`
                  : "https://crystal-heimdall.vercel.app/";
                const cleanRedirect = badgeRedirectUrl.trim() || defaultRedirect;

                if (cleanRedirect !== "https://crystal-heimdall.vercel.app/") {
                  params.set("link", cleanRedirect);
                }

                const qs = params.toString();
                const badgeSvgUrl = `${origin}${path}${qs ? `?${qs}` : ""}`;
                const snippetBadgeSvgUrl = `${canonicalOrigin}${path}${qs ? `?${qs}` : ""}`;

                const markdownSnippet = `[![${displayLabel}](${snippetBadgeSvgUrl})](${cleanRedirect})`;
                const htmlSnippet = `<a href="${cleanRedirect}" target="_blank" rel="noopener noreferrer">\n  <img src="${snippetBadgeSvgUrl}" alt="${displayLabel}" />\n</a>`;

                return (
                  <div className="space-y-6">
                    {/* Live Badge Preview Box */}
                    <div className="p-6 bg-black border-2 border-emerald-500/60 shadow-[4px_4px_0px_#10b981] flex flex-col items-center justify-center gap-3">
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                        // LIVE INTERACTIVE SHIELD PREVIEW //
                      </span>
                      
                      <div className="p-4 bg-zinc-950 border border-zinc-800 flex items-center justify-center min-h-[48px]">
                        <a
                          href={cleanRedirect}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block hover:opacity-90 transition-transform active:scale-95"
                          title={`Click badge to test redirect to ${cleanRedirect}`}
                        >
                          <img 
                            key={badgeSvgUrl} 
                            src={badgeSvgUrl} 
                            alt={displayLabel} 
                            className="h-6 w-auto block max-w-full"
                            onError={(e) => {
                              const target = e.currentTarget as HTMLImageElement;
                              const fallbackUrl = `https://crystal-heimdall.vercel.app${path}${qs ? `?${qs}` : ""}`;
                              if (target.src !== fallbackUrl) {
                                target.src = fallbackUrl;
                              }
                            }}
                          />
                        </a>
                      </div>

                      <div className="flex items-center gap-2 text-xs font-mono text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Interactive SVG: Click the badge above to test live redirect to {cleanRedirect}</span>
                      </div>
                    </div>

                    {/* Code Snippets Box */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Markdown Snippet */}
                      <div className="bg-black border border-zinc-800 p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white uppercase font-mono flex items-center gap-1.5">
                            <Code2 className="w-3.5 h-3.5 text-cyan-400" />
                            GitHub README Markdown
                          </span>
                          <button
                            onClick={() => handleCopy("md-badge", markdownSnippet)}
                            className="px-2.5 py-1 bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white text-xs font-bold font-mono transition"
                          >
                            {copiedKey === "md-badge" ? "COPIED" : "COPY MD"}
                          </button>
                        </div>
                        <pre className="p-2.5 bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-300 font-mono overflow-x-auto">
                          {markdownSnippet}
                        </pre>
                      </div>

                      {/* HTML Snippet */}
                      <div className="bg-black border border-zinc-800 p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white uppercase font-mono flex items-center gap-1.5">
                            <Globe className="w-3.5 h-3.5 text-emerald-400" />
                            HTML Link &amp; Image Embed
                          </span>
                          <button
                            onClick={() => handleCopy("html-badge", htmlSnippet)}
                            className="px-2.5 py-1 bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white text-xs font-bold font-mono transition"
                          >
                            {copiedKey === "html-badge" ? "COPIED" : "COPY HTML"}
                          </button>
                        </div>
                        <pre className="p-2.5 bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-300 font-mono overflow-x-auto">
                          {htmlSnippet}
                        </pre>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* RSS Incident Feed Syndication */}
              <div className="bg-black border border-zinc-800 p-4 sm:p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-2.5">
                  <div className="flex items-center space-x-2 text-xs font-bold text-amber-400 font-mono">
                    <Rss className="w-4 h-4 text-amber-400" />
                    <span>PUBLIC INCIDENT RSS 2.0 FEED SYNDICATION</span>
                  </div>
                  <a
                    href="/api/v1/rss"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1 bg-zinc-900 border border-zinc-700 hover:border-amber-400 text-amber-300 text-[11px] font-bold uppercase flex items-center gap-1.5 self-start sm:self-auto transition font-mono"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>OPEN FEED XML</span>
                  </a>
                </div>
                <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                  External monitoring dashboards, Slack integrations, and reader clients can subscribe directly to this endpoint:
                </p>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={`${window.location.origin}/api/v1/rss`}
                    className="w-full p-2 bg-zinc-950 border border-zinc-800 text-[11px] text-amber-300 font-mono outline-none"
                  />
                  <button
                    onClick={() => handleCopy("rss-feed", `${window.location.origin}/api/v1/rss`)}
                    className="px-3 py-2 bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white text-xs font-bold shrink-0 font-mono"
                  >
                    {copiedKey === "rss-feed" ? "COPIED" : "COPY"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: UPTIME KUMA ADVANCED ENGINE & RETENTION */}
        {activeTab === "advanced" && (
          <div className="space-y-6">
            <div className="bg-[#0b0f17] border-2 border-zinc-700 shadow-[4px_4px_0px_#000] p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-zinc-800 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2 text-xs text-cyan-400 font-bold">
                    <Cpu className="w-4 h-4 text-cyan-400" />
                    <span>[CORE ENGINE SPECIFICATION & PROBE DEFAULTS]</span>
                  </div>
                  <h2 className="text-base sm:text-lg font-black text-white uppercase">
                    Uptime Kuma Engine & Advanced Poller Settings
                  </h2>
                  <p className="text-xs text-zinc-400 font-sans">
                    Configure polling timeouts, retry backoffs, SSL certificate monitoring thresholds, and telemetry lifecycle.
                  </p>
                </div>
                <button
                  onClick={handleSaveAdvancedSettings}
                  disabled={isSavingAdvanced}
                  className="px-6 py-2.5 btn-primary text-xs flex items-center justify-center gap-2 self-start sm:self-auto"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingAdvanced ? "Saving..." : "[ SAVE ENGINE CONFIG ]"}</span>
                </button>
              </div>

              {/* SECTION 1: POLLER DAEMON HEARTBEAT & TIMEOUTS */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-black uppercase text-cyan-400 border-b border-zinc-800 pb-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>01 / Poller Heartbeat & Backoff Intervals</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase block">
                      DEFAULT INTERVAL (SEC)
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="86400"
                      value={advancedSettings.default_poll_interval}
                      onChange={(e) => setAdvancedSettings({ ...advancedSettings, default_poll_interval: e.target.value })}
                      className="w-full p-2.5 bg-black border-2 border-zinc-700 text-white font-mono text-xs focus:border-cyan-400 outline-none"
                    />
                    <span className="text-[10px] text-zinc-500">Global probe cycle frequency (Default: 60s)</span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase block">
                      TIMEOUT THRESHOLD (SEC)
                    </label>
                    <input
                      type="number"
                      min="2"
                      max="120"
                      value={advancedSettings.default_timeout}
                      onChange={(e) => setAdvancedSettings({ ...advancedSettings, default_timeout: e.target.value })}
                      className="w-full p-2.5 bg-black border-2 border-zinc-700 text-white font-mono text-xs focus:border-cyan-400 outline-none"
                    />
                    <span className="text-[10px] text-zinc-500">Connection read & TLS handshake timeout</span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase block">
                      MAX RETRY ATTEMPTS
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={advancedSettings.max_retries}
                      onChange={(e) => setAdvancedSettings({ ...advancedSettings, max_retries: e.target.value })}
                      className="w-full p-2.5 bg-black border-2 border-zinc-700 text-white font-mono text-xs focus:border-cyan-400 outline-none"
                    />
                    <span className="text-[10px] text-zinc-500">Consecutive failures before tripping incident</span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase block">
                      RESEND ALERT COOLDOWN (MIN)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="1440"
                      value={advancedSettings.resend_interval}
                      onChange={(e) => setAdvancedSettings({ ...advancedSettings, resend_interval: e.target.value })}
                      className="w-full p-2.5 bg-black border-2 border-zinc-700 text-white font-mono text-xs focus:border-cyan-400 outline-none"
                    />
                    <span className="text-[10px] text-zinc-500">Repeat dispatch rate for continuing outages</span>
                  </div>
                </div>
              </div>

              {/* SECTION 2: TLS / SSL CERTIFICATE INSPECTION */}
              <div className="space-y-3 pt-3">
                <div className="flex items-center gap-2 text-xs font-black uppercase text-amber-400 border-b border-zinc-800 pb-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  <span>02 / TLS / SSL Certificate Validation Matrix</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase block">
                      CERTIFICATE EXPIRY ALERT WINDOW (DAYS)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={advancedSettings.ssl_warning_days}
                      onChange={(e) => setAdvancedSettings({ ...advancedSettings, ssl_warning_days: e.target.value })}
                      className="w-full p-2.5 bg-black border-2 border-zinc-700 text-white font-mono text-xs focus:border-amber-400 outline-none"
                    />
                    <span className="text-[10px] text-zinc-500">Trigger proactive warning when cert expires within N days (Default: 30)</span>
                  </div>

                  <label className="p-4 bg-zinc-950 border-2 border-zinc-800 flex items-center justify-between cursor-pointer hover:border-zinc-700">
                    <div className="space-y-0.5 pr-2">
                      <span className="text-xs font-bold text-white block uppercase">Ignore Invalid / Self-Signed SSL</span>
                      <span className="text-[11px] text-zinc-500 font-sans block">Permit self-signed certificates and hostname mismatches without marking service offline</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={advancedSettings.ignore_ssl_errors}
                      onChange={(e) => setAdvancedSettings({ ...advancedSettings, ignore_ssl_errors: e.target.checked })}
                      className="w-4 h-4 accent-amber-400 cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              {/* SECTION 3: HTTP PROBE DEFAULTS & ASSERTIONS */}
              <div className="space-y-3 pt-3">
                <div className="flex items-center gap-2 text-xs font-black uppercase text-emerald-400 border-b border-zinc-800 pb-1.5">
                  <Server className="w-3.5 h-3.5" />
                  <span>03 / HTTP Protocol Specifications & Assertions</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase block">
                      DEFAULT HTTP METHOD
                    </label>
                    <select
                      value={advancedSettings.default_http_method}
                      onChange={(e) => setAdvancedSettings({ ...advancedSettings, default_http_method: e.target.value })}
                      className="w-full p-2.5 bg-black border-2 border-zinc-700 text-white font-mono text-xs focus:border-emerald-400 outline-none"
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="HEAD">HEAD</option>
                      <option value="PUT">PUT</option>
                      <option value="PATCH">PATCH</option>
                    </select>
                    <span className="text-[10px] text-zinc-500">Method used for generic URL endpoints</span>
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase block">
                      CUSTOM USER-AGENT HEADER
                    </label>
                    <input
                      type="text"
                      value={advancedSettings.user_agent}
                      onChange={(e) => setAdvancedSettings({ ...advancedSettings, user_agent: e.target.value })}
                      className="w-full p-2.5 bg-black border-2 border-zinc-700 text-white font-mono text-xs focus:border-emerald-400 outline-none"
                    />
                    <span className="text-[10px] text-zinc-500">Sent with all automated synthetic ping requests</span>
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase block">
                      ACCEPTED HTTP STATUS CODES
                    </label>
                    <input
                      type="text"
                      value={advancedSettings.accepted_status_codes}
                      onChange={(e) => setAdvancedSettings({ ...advancedSettings, accepted_status_codes: e.target.value })}
                      placeholder="200-299, 301, 302"
                      className="w-full p-2.5 bg-black border-2 border-zinc-700 text-white font-mono text-xs focus:border-emerald-400 outline-none"
                    />
                    <span className="text-[10px] text-zinc-500">Ranges and comma-separated codes treated as healthy</span>
                  </div>

                  <label className="p-4 bg-zinc-950 border-2 border-zinc-800 flex items-center justify-between cursor-pointer hover:border-zinc-700">
                    <div className="space-y-0.5 pr-2">
                      <span className="text-xs font-bold text-white block uppercase">Follow HTTP Redirects</span>
                      <span className="text-[11px] text-zinc-500 font-sans block">Automatically follow 301/302 redirects up to 5 hops</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={advancedSettings.follow_redirects}
                      onChange={(e) => setAdvancedSettings({ ...advancedSettings, follow_redirects: e.target.checked })}
                      className="w-4 h-4 accent-emerald-400 cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              {/* SECTION 4: DATA RETENTION & SQLITE MAINTENANCE */}
              <div className="space-y-4 pt-3 border-t-2 border-zinc-800">
                <div className="flex items-center gap-2 text-xs font-black uppercase text-red-400">
                  <Database className="w-3.5 h-3.5" />
                  <span>04 / Data Retention Policy & Maintenance Center</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-1.5 md:col-span-1">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase block">
                      TELEMETRY RETENTION (DAYS)
                    </label>
                    <input
                      type="number"
                      min="7"
                      max="365"
                      value={advancedSettings.telemetry_retention_days}
                      onChange={(e) => setAdvancedSettings({ ...advancedSettings, telemetry_retention_days: e.target.value })}
                      className="w-full p-2.5 bg-black border-2 border-zinc-700 text-white font-mono text-xs focus:border-red-400 outline-none"
                    />
                    <span className="text-[10px] text-zinc-500">Purge heartbeats older than N days</span>
                  </div>

                  <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-3 self-center pt-1">
                    <button
                      onClick={() => handlePurgeAction("purge_resolved_incidents", "Purge Incidents")}
                      disabled={isPurging}
                      className="p-3 bg-zinc-950 border-2 border-zinc-800 hover:border-amber-500/80 hover:bg-zinc-900 text-zinc-300 hover:text-white transition flex flex-col items-center justify-center gap-1.5 text-center group"
                    >
                      <Trash2 className="w-4 h-4 text-zinc-400 group-hover:text-amber-400" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">[ PURGE RESOLVED INCIDENTS ]</span>
                    </button>

                    <button
                      onClick={() => handlePurgeAction("prune_telemetry", "Prune Telemetry")}
                      disabled={isPurging}
                      className="p-3 bg-zinc-950 border-2 border-zinc-800 hover:border-cyan-500/80 hover:bg-zinc-900 text-zinc-300 hover:text-white transition flex flex-col items-center justify-center gap-1.5 text-center group"
                    >
                      <Layers className="w-4 h-4 text-zinc-400 group-hover:text-cyan-400" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">[ PRUNE OLD TELEMETRY ]</span>
                    </button>

                    <button
                      onClick={() => handlePurgeAction("vacuum", "Vacuum Database")}
                      disabled={isPurging}
                      className="p-3 bg-zinc-950 border-2 border-zinc-800 hover:border-emerald-500/80 hover:bg-zinc-900 text-zinc-300 hover:text-white transition flex flex-col items-center justify-center gap-1.5 text-center group"
                    >
                      <Database className="w-4 h-4 text-zinc-400 group-hover:text-emerald-400" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">[ VACUUM SQLITE DATABASE ]</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: EMERGENCY NOTIFICATION DISPATCH (DISCORD, TELEGRAM & GENERIC WEBHOOK) */}
        {activeTab === "alerts" && (
          <div className="space-y-6">
            <div className="bg-[#0b0f17] border-2 border-zinc-700 shadow-[4px_4px_0px_#000] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2 text-xs text-rose-400 font-bold">
                  <Send className="w-4 h-4 text-rose-400" />
                  <span>[OUTBOUND NOTIFICATION CONDUITS &amp; ALERTS]</span>
                </div>
                <h2 className="text-base sm:text-lg font-black text-white uppercase">
                  Notification Dispatch Conduits
                </h2>
                <p className="text-xs text-zinc-400 font-sans">
                  Configure direct webhooks and bot conduits to automatically dispatch instant incident alerts when services degrade or go down.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Discord */}
              <div className="bg-[#0b0f17] border-2 border-zinc-700 shadow-[4px_4px_0px_#000] p-6 space-y-5 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-zinc-900 border-2 border-[#5865F2] flex items-center justify-center text-[#5865F2]">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-white text-sm uppercase">Discord Relay</h3>
                      <p className="text-[11px] text-zinc-400 font-sans">Rich embeds with severity & traces</p>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-mono text-zinc-400 block mb-1 font-bold uppercase">
                      DISCORD WEBHOOK URL
                    </label>
                    <div className="relative">
                      <input
                        type={showDiscord ? "text" : "password"}
                        placeholder="https://discord.com/api/webhooks/..."
                        value={discordWebhookUrl}
                        onChange={(e) => setDiscordWebhookUrl(e.target.value)}
                        className="w-full p-2.5 bg-black border-2 border-zinc-700 pr-10 text-white font-mono text-xs focus:border-[#5865F2] outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowDiscord(!showDiscord)}
                        className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300"
                      >
                        {showDiscord ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {discordStatus && (
                    <div className="p-3 bg-black border border-zinc-800 text-[11px] font-mono">
                      {discordStatus}
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t-2 border-zinc-800">
                  <button
                    onClick={handleTestDiscord}
                    disabled={discordTesting}
                    className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 border-2 border-[#5865F2] text-[#a5b4fc] text-xs font-bold uppercase flex items-center justify-center gap-2 active:translate-x-[1px] active:translate-y-[1px]"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{discordTesting ? "Dispatching..." : "Send Test Discord"}</span>
                  </button>
                </div>
              </div>

              {/* Telegram */}
              <div className="bg-[#0b0f17] border-2 border-zinc-700 shadow-[4px_4px_0px_#000] p-6 space-y-5 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-zinc-900 border-2 border-[#229ED9] flex items-center justify-center text-[#229ED9]">
                      <Send className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-white text-sm uppercase">Telegram Bot</h3>
                      <p className="text-[11px] text-zinc-400 font-sans">Instant mobile push notifications</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] font-mono text-zinc-400 block mb-1 font-bold uppercase">
                        TELEGRAM BOT TOKEN
                      </label>
                      <div className="relative">
                        <input
                          type={showTelegramToken ? "text" : "password"}
                          placeholder="123456789:ABCdefGhIJKlmNoPQRstuVWxyz"
                          value={telegramToken}
                          onChange={(e) => setTelegramToken(e.target.value)}
                          className="w-full p-2.5 bg-black border-2 border-zinc-700 pr-10 text-white font-mono text-xs focus:border-[#229ED9] outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowTelegramToken(!showTelegramToken)}
                          className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300"
                        >
                          {showTelegramToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-mono text-zinc-400 block mb-1 font-bold uppercase">
                        TARGET CHAT ID
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 987654321"
                        value={telegramChatId}
                        onChange={(e) => setTelegramChatId(e.target.value)}
                        className="w-full p-2.5 bg-black border-2 border-zinc-700 text-white font-mono text-xs focus:border-[#229ED9] outline-none"
                      />
                    </div>
                  </div>

                  {telegramStatus && (
                    <div className="p-3 bg-black border border-zinc-800 text-[11px] font-mono">
                      {telegramStatus}
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t-2 border-zinc-800">
                  <button
                    onClick={handleTestTelegram}
                    disabled={telegramTesting}
                    className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 border-2 border-[#229ED9] text-[#7dd3fc] text-xs font-bold uppercase flex items-center justify-center gap-2 active:translate-x-[1px] active:translate-y-[1px]"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{telegramTesting ? "Dispatching..." : "Send Test Telegram"}</span>
                  </button>
                </div>
              </div>

              {/* Generic Webhook */}
              <div className="bg-[#0b0f17] border-2 border-zinc-700 shadow-[4px_4px_0px_#000] p-6 space-y-5 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-zinc-900 border-2 border-emerald-500 flex items-center justify-center text-emerald-400">
                      <Webhook className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-white text-sm uppercase">Generic Webhook</h3>
                      <p className="text-[11px] text-zinc-400 font-sans">Slack, n8n, Zapier & custom relays</p>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-mono text-zinc-400 block mb-1 font-bold uppercase">
                      WEBHOOK ENDPOINT URL
                    </label>
                    <input
                      type="text"
                      placeholder="https://hooks.slack.com/... or https://n8n.internal/..."
                      value={genericWebhookUrl}
                      onChange={(e) => setGenericWebhookUrl(e.target.value)}
                      className="w-full p-2.5 bg-black border-2 border-zinc-700 text-white font-mono text-xs focus:border-emerald-400 outline-none"
                    />
                    <span className="text-[10px] text-zinc-500 mt-1 block">Receives standard structured JSON incident alerts</span>
                  </div>

                  {genericStatus && (
                    <div className="p-3 bg-black border border-zinc-800 text-[11px] font-mono">
                      {genericStatus}
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t-2 border-zinc-800">
                  <button
                    onClick={handleTestGenericWebhook}
                    disabled={genericTesting}
                    className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 border-2 border-emerald-500 text-emerald-300 text-xs font-bold uppercase flex items-center justify-center gap-2 active:translate-x-[1px] active:translate-y-[1px]"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{genericTesting ? "Dispatching..." : "Send Test Webhook"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* IN-BROWSER CONDUIT & PAYLOAD SIMULATOR */}
            <div className="bg-[#0b0f17] border-2 border-zinc-700 shadow-[4px_4px_0px_#000] p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-zinc-800 pb-4">
                <div>
                  <div className="flex items-center space-x-2 text-xs text-cyan-400 font-bold mb-1">
                    <Terminal className="w-4 h-4 text-cyan-400" />
                    <span>[05.B] IN-BROWSER WEBHOOK CONDUIT &amp; ALERT SIMULATOR</span>
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-white uppercase">
                    Diagnostic Incident Payload Simulator
                  </h3>
                  <p className="text-xs text-zinc-400 font-sans mt-0.5">
                    Safely fire simulated incident payloads (Downtime, Latency Spikes, Recovery) against your external channels without triggering fleet alarms or skewing SLA metrics.
                  </p>
                </div>

                <div className="px-3 py-1 bg-black border border-zinc-800 text-[10px] text-zinc-400 font-mono shrink-0">
                  <span>ZERO-IMPACT SANDBOX</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Controls */}
                <div className="space-y-4">
                  {/* Scenario Rockers */}
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1.5">
                      1. SIMULATION SEVERITY &amp; SCENARIO
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: "critical", label: "CRITICAL OUTAGE", color: "bg-rose-950 border-rose-500 text-rose-300" },
                        { id: "warning", label: "DEGRADED LATENCY", color: "bg-amber-950 border-amber-400 text-amber-300" },
                        { id: "info", label: "SERVICE RECOVERED", color: "bg-emerald-950 border-emerald-400 text-emerald-300" },
                      ].map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSimScenario(s.id as any)}
                          className={`p-2 text-[10px] font-bold uppercase border transition ${
                            simScenario === s.id
                              ? `${s.color} shadow-[2px_2px_0px_#000]`
                              : "bg-black border-zinc-800 text-zinc-500 hover:text-white"
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Target Conduit */}
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1.5">
                      2. TARGET DISPATCH CONDUIT
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: "generic", label: "GENERIC WEBHOOK" },
                        { id: "discord", label: "DISCORD RELAY" },
                        { id: "telegram", label: "TELEGRAM BOT" },
                      ].map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSimTarget(t.id as any)}
                          className={`p-2 text-[10px] font-bold uppercase border transition ${
                            simTarget === t.id
                              ? "bg-zinc-800 border-cyan-400 text-cyan-300 shadow-[2px_2px_0px_#000]"
                              : "bg-black border-zinc-800 text-zinc-500 hover:text-white"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Service Target Name */}
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">
                      3. SIMULATED TARGET NAME
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Crystal Auth Gateway"
                      value={simServiceName}
                      onChange={(e) => setSimServiceName(e.target.value)}
                      className="w-full p-2 bg-black border border-zinc-700 text-xs text-white outline-none focus:border-cyan-400 font-mono"
                    />
                  </div>

                  {/* Custom Title & Message */}
                  <div className="space-y-2">
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">
                        OPTIONAL TITLE OVERRIDE
                      </label>
                      <input
                        type="text"
                        placeholder="Simulated Synthetic Probe Failure (Leave blank for default)"
                        value={simCustomTitle}
                        onChange={(e) => setSimCustomTitle(e.target.value)}
                        className="w-full p-2 bg-black border border-zinc-700 text-xs text-white outline-none focus:border-cyan-400 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">
                        OPTIONAL DETAILS OVERRIDE
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Simulation payload dispatched from Crystal Heimdall Command Deck"
                        value={simCustomMessage}
                        onChange={(e) => setSimCustomMessage(e.target.value)}
                        className="w-full p-2 bg-black border border-zinc-700 text-xs text-white outline-none focus:border-cyan-400 font-mono resize-none"
                      />
                    </div>
                  </div>

                  {/* Dispatch Action */}
                  <button
                    type="button"
                    onClick={handleRunSimulation}
                    disabled={simIsRunning}
                    className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black font-black uppercase text-xs flex items-center justify-center gap-2 shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{simIsRunning ? "Executing Conduit Simulation..." : "Dispatch Conduit Simulation"}</span>
                  </button>
                </div>

                {/* Right Diagnostic Console / Output */}
                <div className="bg-black border border-zinc-800 p-4 space-y-3 flex flex-col justify-between font-mono text-xs">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                      <span className="text-zinc-500 uppercase font-bold text-[10px]">
                        // SIMULATOR CONSOLE //
                      </span>
                      {simResult && (
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.2 text-[9px] font-bold uppercase border ${
                            simResult.success
                              ? "bg-emerald-950 border-emerald-500 text-emerald-400"
                              : "bg-rose-950 border-rose-500 text-rose-400"
                          }`}>
                            {simResult.success ? "HTTP 200 DELIVERED" : "DELIVERY FAILED"}
                          </span>
                          {simResult.latencyMs !== undefined && (
                            <span className="text-[10px] text-zinc-400">{simResult.latencyMs}ms</span>
                          )}
                        </div>
                      )}
                    </div>

                    {simResult ? (
                      <div className="space-y-2">
                        <p className={`text-xs ${simResult.success ? "text-emerald-400 font-bold" : "text-rose-400"}`}>
                          {simResult.message}
                        </p>
                        {simResult.simulatedPayload && (
                          <div className="space-y-1">
                            <span className="text-[10px] text-zinc-500 uppercase block">DISPATCHED PAYLOAD:</span>
                            <pre className="p-2.5 bg-[#070a0f] border border-zinc-800 text-[10px] text-zinc-300 overflow-x-auto leading-relaxed">
                              {JSON.stringify(simResult.simulatedPayload, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="py-12 text-center space-y-2">
                        <Radio className="w-8 h-8 text-zinc-700 mx-auto animate-pulse" />
                        <p className="text-zinc-500 text-xs">
                          Simulator idle. Click [Dispatch Conduit Simulation] to test webhook round-trip.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-zinc-900 text-[10px] text-zinc-600">
                    Safe testing conduit • No false incidents recorded • No fleet alarm sirens triggered
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        
        {/* TAB 6: SUBSCRIBERS MANAGEMENT */}
        {activeTab === "subscribers" && (
          <div className="space-y-6">
            <div className="bg-[#0b0f17] border-2 border-zinc-700 shadow-[4px_4px_0px_#000] p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-zinc-800 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2 text-xs text-emerald-400 font-bold">
                    <Mail className="w-4 h-4 text-emerald-400" />
                    <span>[PUBLIC OUTAGE &amp; INCIDENT SUBSCRIBERS]</span>
                  </div>
                  <h2 className="text-base sm:text-lg font-black text-white uppercase">
                    Incident Notification Subscribers
                  </h2>
                  <p className="text-xs text-zinc-400 font-sans">
                    Monitor and manage external users and engineering teams subscribed to public outage and recovery broadcasts.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={fetchSubscribers}
                  disabled={isLoadingSubscribers}
                  className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 hover:border-emerald-400 text-zinc-300 hover:text-white text-xs font-bold uppercase flex items-center gap-1.5 self-start sm:self-auto transition shadow-[1px_1px_0px_#000]"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSubscribers ? "animate-spin text-emerald-400" : ""}`} />
                  <span>Refresh List</span>
                </button>
              </div>

              {/* Metric Counters */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-black border border-zinc-800 space-y-1">
                  <span className="text-[10px] text-zinc-500 uppercase font-bold">ACTIVE SUBSCRIBERS</span>
                  <div className="text-2xl font-black text-white font-mono">{subscriberStats.total}</div>
                </div>
                <div className="p-4 bg-black border border-zinc-800 space-y-1">
                  <span className="text-[10px] text-emerald-500 uppercase font-bold">EMAIL NOTIFICATIONS</span>
                  <div className="text-2xl font-black text-emerald-400 font-mono">{subscriberStats.emailCount}</div>
                </div>
                <div className="p-4 bg-black border border-zinc-800 space-y-1">
                  <span className="text-[10px] text-cyan-500 uppercase font-bold">WEBHOOK RELAYS</span>
                  <div className="text-2xl font-black text-cyan-400 font-mono">{subscriberStats.webhookCount}</div>
                </div>
              </div>

              {/* Subscribers Table */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Registered Subscriber Conduits ({subscribers.length})
                </h3>

                {subscribers.length === 0 ? (
                  <div className="p-8 bg-black border border-zinc-800 text-center space-y-2">
                    <Mail className="w-8 h-8 text-zinc-600 mx-auto" />
                    <p className="text-xs text-zinc-400 uppercase font-bold">No subscribers registered yet</p>
                    <p className="text-[11px] text-zinc-500 font-sans">
                      Visitors can subscribe directly on the public Status Page via Email or Webhook.
                    </p>
                  </div>
                ) : (
                  <div className="bg-black border border-zinc-800 divide-y divide-zinc-800/80 overflow-x-auto">
                    {subscribers.map((sub) => (
                      <div key={sub.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className={`px-1.5 py-0.2 text-[9px] font-bold uppercase border ${
                              sub.type === "email"
                                ? "bg-emerald-950 border-emerald-500 text-emerald-300"
                                : "bg-cyan-950 border-cyan-500 text-cyan-300"
                            }`}>
                              {sub.type}
                            </span>
                            <span className="font-bold text-white truncate max-w-sm sm:max-w-md">
                              {sub.target}
                            </span>
                            <span className="px-1.5 py-0.2 text-[9px] bg-zinc-900 border border-zinc-800 text-zinc-400 uppercase">
                              Scope: {sub.scope}
                            </span>
                          </div>
                          <div className="text-[10px] text-zinc-500 flex items-center gap-3">
                            <span>ID: {sub.id}</span>
                            <span>•</span>
                            <span>Registered: {new Date(sub.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto">
                          <button
                            type="button"
                            onClick={() => handleDeleteSubscriber(sub.id)}
                            className="px-2.5 py-1 bg-zinc-900 border border-zinc-700 hover:border-rose-500 text-rose-400 hover:text-rose-300 text-[10px] font-bold uppercase flex items-center gap-1 transition"
                            title="Revoke subscription"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Revoke</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: MAINTENANCE PLANNER */}
        {activeTab === "maintenance" && (
          <div className="space-y-6">
            <div className="bg-[#0b0f17] border-2 border-zinc-700 shadow-[4px_4px_0px_#000] p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-zinc-800 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2 text-xs text-amber-400 font-bold">
                    <Wrench className="w-4 h-4 text-amber-400" />
                    <span>[SCHEDULED MAINTENANCE ENGINE &amp; CALENDAR]</span>
                  </div>
                  <h2 className="text-base sm:text-lg font-black text-white uppercase">
                    Maintenance Windows &amp; Downtime Planner
                  </h2>
                  <p className="text-xs text-zinc-400 font-sans">
                    Schedule upcoming infrastructure updates, suppress siren alarms during maintenance, and publish iCalendar (.ics) sync feeds for users.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsMaintModalOpen(true)}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black uppercase flex items-center gap-1.5 self-start sm:self-auto shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
                >
                  <Plus className="w-4 h-4" />
                  <span>Plan Maintenance Window</span>
                </button>
              </div>

              {/* Maintenance Windows List */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Configured Maintenance Windows ({maintenanceWindows.length})
                </h3>

                {maintenanceWindows.length === 0 ? (
                  <div className="p-8 bg-black border border-zinc-800 text-center space-y-2">
                    <Calendar className="w-8 h-8 text-zinc-600 mx-auto" />
                    <p className="text-xs text-zinc-400 uppercase font-bold">No maintenance windows scheduled</p>
                    <p className="text-[11px] text-zinc-500 font-sans">
                      Plan maintenance windows in advance to announce updates on the Status Page and auto-suppress alarm sirens.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {maintenanceWindows.map((m) => {
                      const isActive = m.status === "in_progress";
                      const isUpcoming = m.status === "scheduled";

                      return (
                        <div
                          key={m.id}
                          className={`p-4 border-2 shadow-[2px_2px_0px_#000] space-y-3 text-xs ${
                            isActive
                              ? "bg-[#181308] border-amber-500"
                              : isUpcoming
                              ? "bg-[#0b141d] border-sky-500"
                              : "bg-black border-zinc-800 opacity-75"
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-2">
                            <div className="flex items-center space-x-2">
                              <span className={`px-2 py-0.5 text-[9px] font-black uppercase border ${
                                isActive
                                  ? "bg-amber-950 border-amber-400 text-amber-300"
                                  : isUpcoming
                                  ? "bg-sky-950 border-sky-400 text-sky-300"
                                  : "bg-zinc-900 border-zinc-700 text-zinc-400"
                              }`}>
                                {m.status}
                              </span>
                              <h4 className="font-bold text-white uppercase text-xs sm:text-sm">{m.title}</h4>
                            </div>

                            <div className="flex items-center space-x-2 self-end sm:self-auto">
                              <a
                                href={`/api/v1/maintenance/${m.id}/ics`}
                                download
                                className="px-2 py-1 bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-zinc-300 text-[10px] font-bold uppercase flex items-center gap-1"
                                title="Download RFC 5545 iCalendar (.ics)"
                              >
                                <Download className="w-3 h-3" />
                                <span>.ICS</span>
                              </a>

                              {isActive && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateMaintenanceStatus(m.id, "completed")}
                                  className="px-2 py-1 bg-emerald-950 border border-emerald-500 text-emerald-300 hover:bg-emerald-900 text-[10px] font-bold uppercase"
                                >
                                  Complete Window
                                </button>
                              )}

                              {isUpcoming && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateMaintenanceStatus(m.id, "in_progress")}
                                  className="px-2 py-1 bg-amber-950 border border-amber-500 text-amber-300 hover:bg-amber-900 text-[10px] font-bold uppercase"
                                >
                                  Start Window Now
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleDeleteMaintenance(m.id)}
                                className="p-1 text-zinc-500 hover:text-rose-400 transition"
                                title="Delete maintenance window"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {m.description && (
                            <p className="text-zinc-300 font-sans text-xs leading-relaxed">
                              {m.description}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-4 text-[11px] text-zinc-400 font-mono">
                            <div>
                              <span className="text-zinc-500">WINDOW: </span>
                              <span className="text-white font-bold">{new Date(m.startTime).toLocaleString()} &rarr; {new Date(m.endTime).toLocaleString()}</span>
                            </div>
                            {m.affectedServices && m.affectedServices.length > 0 && (
                              <div className="flex items-center gap-1">
                                <span className="text-zinc-500">TARGETS:</span>
                                {m.affectedServices.map((svc: string) => (
                                  <span key={svc} className="px-1.5 py-0.2 bg-black border border-zinc-700 text-zinc-300 text-[9px]">
                                    {svc}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 8: ACCESS & SECURITY */}
        {activeTab === "security" && (
          <div className="bg-[#0b0f17] border-2 border-emerald-500/50 shadow-[4px_4px_0px_#000] p-6 sm:p-8 space-y-4">
            <div className="flex items-center space-x-3">
              <Shield className="w-5 h-5 text-emerald-400" />
              <h2 className="text-sm font-black text-white uppercase font-mono">
                SECURITY & 2FA-ONLY OPERATOR ACCESS SPECIFICATION
              </h2>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed font-sans">
              Crystal-Heimdall strictly isolates operator commands behind direct Two-Factor Authentication (2FA Only). There are no master passcodes and no GitHub OAuth dependencies. Operators authenticate directly using a rolling 6-digit Time-based One-Time Password (RFC 6238 TOTP) from Google Authenticator, Ente Auth, or 1Password. In development and testing environments, bypass code <code className="text-emerald-400 font-mono font-bold">000000</code> is accepted.
            </p>

            {/* Operator Session Revocation Card */}
            <div className="p-4 bg-black border-2 border-rose-900/60 flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
              <div className="space-y-1">
                <div className="text-xs font-bold text-rose-400 font-mono flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  <span>ACTIVE 2FA OPERATOR SESSION</span>
                </div>
                <p className="text-[11px] text-zinc-400 font-mono">
                  Session token stored securely in localStorage. Terminating session revokes all operator control deck access immediately.
                </p>
              </div>
              <button
                type="button"
                onClick={handleOperatorSignOut}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-black font-mono font-black text-xs uppercase flex items-center gap-2 shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition shrink-0"
                title="Terminate operator session"
              >
                <LogOut className="w-4 h-4" />
                <span>[ TERMINATE OPERATOR SESSION ]</span>
              </button>
            </div>
          </div>
        )}

        {/* CREATE / EDIT PROJECT GROUP MODAL */}
        {isGroupModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 font-mono text-xs overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsGroupModalOpen(false);
            }}
          >
            <div className="bg-[#0b0f17] border-2 border-cyan-500 shadow-[6px_6px_0px_#06b6d4] max-w-lg w-full p-6 space-y-5 relative">
              <div className="flex items-center justify-between border-b-2 border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-cyan-950 border border-cyan-400 flex items-center justify-center text-cyan-400 font-bold">
                    <FolderPlus className="w-4 h-4" />
                  </div>
                  <h3 className="font-black text-sm uppercase text-white">
                    {editingGroup ? "// EDIT PROJECT GROUP //" : "// CREATE PROJECT GROUP //"}
                  </h3>
                </div>
                <button
                  onClick={() => setIsGroupModalOpen(false)}
                  className="p-1 bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveGroup} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">
                    GROUP / PROJECT NAME *
                  </label>
                  <input
                    type="text"
                    required
                    value={groupForm.name}
                    onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                    placeholder="e.g. Campus Relay, KrishiSetu, Internal APIs"
                    className="w-full p-2.5 bg-black border border-zinc-700 text-white font-mono text-xs focus:border-cyan-400 outline-none"
                  />
                  {editingGroup && (
                    <p className="text-[10px] text-amber-400 mt-1 font-sans">
                      ⚠️ Renaming will cascade update all linked services in the database automatically.
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">
                    ENVIRONMENT TIER
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { id: "production", label: "PROD" },
                      { id: "staging", label: "STAGING" },
                      { id: "development", label: "DEV" },
                      { id: "edge", label: "EDGE" },
                    ].map((env) => (
                      <button
                        type="button"
                        key={env.id}
                        onClick={() => setGroupForm({ ...groupForm, environment: env.id as any })}
                        className={`p-2 text-[10px] font-bold border transition uppercase text-center ${
                          groupForm.environment === env.id
                            ? "bg-cyan-950 border-cyan-400 text-cyan-300"
                            : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white"
                        }`}
                      >
                        {env.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">
                    ACCENT COLOR
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      "#10b981",
                      "#06b6d4",
                      "#3b82f6",
                      "#8b5cf6",
                      "#f59e0b",
                      "#ec4899",
                      "#f43f5e",
                      "#64748b",
                    ].map((col) => (
                      <button
                        type="button"
                        key={col}
                        onClick={() => setGroupForm({ ...groupForm, color: col })}
                        className={`w-6 h-6 border-2 transition ${
                          groupForm.color.toLowerCase() === col.toLowerCase()
                            ? "border-white scale-110 shadow-[0_0_6px_#fff]"
                            : "border-transparent opacity-80 hover:opacity-100"
                        }`}
                        style={{ backgroundColor: col }}
                      />
                    ))}
                    <input
                      type="text"
                      value={groupForm.color}
                      onChange={(e) => setGroupForm({ ...groupForm, color: e.target.value })}
                      placeholder="#06b6d4"
                      className="w-24 p-1.5 bg-black border border-zinc-700 text-white font-mono text-[11px] focus:border-cyan-400 outline-none text-center"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">
                    DESCRIPTION (OPTIONAL)
                  </label>
                  <textarea
                    rows={2}
                    value={groupForm.description}
                    onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                    placeholder="Short description of this environment or project scope..."
                    className="w-full p-2.5 bg-black border border-zinc-700 text-white font-mono text-xs focus:border-cyan-400 outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setIsGroupModalOpen(false)}
                    className="px-4 py-2 bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white text-xs font-bold"
                  >
                    [ CANCEL ]
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingGroup}
                    className="px-5 py-2 btn-primary text-xs font-bold"
                  >
                    {isSavingGroup ? "SAVING..." : editingGroup ? "[ UPDATE GROUP ]" : "[ CREATE GROUP ]"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      
        {/* SCHEDULE MAINTENANCE WINDOW MODAL */}
        {isMaintModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 font-mono text-xs overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsMaintModalOpen(false);
            }}
          >
            <div className="bg-[#0b0f17] border-2 border-amber-500 shadow-[6px_6px_0px_#f59e0b] max-w-lg w-full p-6 space-y-5 relative">
              <div className="flex items-center justify-between border-b-2 border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-amber-950 border border-amber-400 flex items-center justify-center text-amber-400 font-bold">
                    <Wrench className="w-4 h-4" />
                  </div>
                  <h3 className="font-black text-sm uppercase text-white">
                    // PLAN MAINTENANCE WINDOW //
                  </h3>
                </div>
                <button
                  onClick={() => setIsMaintModalOpen(false)}
                  className="p-1 bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateMaintenance} className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">
                    WINDOW TITLE *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. LibSQL Cluster Upgrade & Storage Migration"
                    value={maintForm.title}
                    onChange={(e) => setMaintForm({ ...maintForm, title: e.target.value })}
                    className="w-full p-2 bg-black border border-zinc-700 text-white text-xs outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">
                    CONTEXTUAL DESCRIPTION
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Brief description of the maintenance activity visible to visitors"
                    value={maintForm.description}
                    onChange={(e) => setMaintForm({ ...maintForm, description: e.target.value })}
                    className="w-full p-2 bg-black border border-zinc-700 text-white text-xs outline-none focus:border-amber-400 resize-none font-sans"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">
                      START DATE &amp; TIME *
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={maintForm.startTime}
                      onChange={(e) => setMaintForm({ ...maintForm, startTime: e.target.value })}
                      className="w-full p-2 bg-black border border-zinc-700 text-white text-xs outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">
                      END DATE &amp; TIME *
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={maintForm.endTime}
                      onChange={(e) => setMaintForm({ ...maintForm, endTime: e.target.value })}
                      className="w-full p-2 bg-black border border-zinc-700 text-white text-xs outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">
                    INITIAL WINDOW STATUS
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setMaintForm({ ...maintForm, status: "scheduled" })}
                      className={`p-2 border text-[11px] font-bold uppercase transition ${
                        maintForm.status === "scheduled"
                          ? "bg-sky-950 border-sky-400 text-sky-300"
                          : "bg-black border-zinc-800 text-zinc-500"
                      }`}
                    >
                      SCHEDULED
                    </button>
                    <button
                      type="button"
                      onClick={() => setMaintForm({ ...maintForm, status: "in_progress" })}
                      className={`p-2 border text-[11px] font-bold uppercase transition ${
                        maintForm.status === "in_progress"
                          ? "bg-amber-950 border-amber-400 text-amber-300"
                          : "bg-black border-zinc-800 text-zinc-500"
                      }`}
                    >
                      IN PROGRESS NOW
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end space-x-2 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setIsMaintModalOpen(false)}
                    className="px-3 py-2 bg-zinc-900 border border-zinc-700 text-zinc-300 text-xs font-bold uppercase"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black uppercase flex items-center gap-1.5 shadow-[2px_2px_0px_#000]"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Window</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

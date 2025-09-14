import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { getCustomers, formatVN, isSameDayInVN } from "./api";
import type { TigerCustomer } from "./types";
import {
  Loader2,
  Users,
  UserPlus,
  Search,
  Filter,
  BarChart3,
  Trophy,
  FileSpreadsheet,
  RefreshCw,
  Wifi,
  WifiOff,
  TrendingUp,
  Activity,
  Clock,
  ChevronDown,
  ChevronUp,
  Menu,
  X,
  Bell,
  Settings,
  Trash2,
  AlertTriangle,
  Download,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/* ---------- Types ---------- */
type FilterWinner = "all" | "winner" | "non-winner";
type SortField = "joinedAt" | "fullName" | "id";
type SortDirection = "asc" | "desc";

type Stats = {
  total: number;
  winners: number;
  today: number;
  thisWeek: number;
  growthRate: number;
};

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
const REALTIME_INTERVAL = 30_000; // 10 giây

/* ---------- API helpers ---------- */
// Tải toàn bộ dữ liệu Event (Excel) từ BE (GET /export-all-excel)
const exportAllExcel = async (): Promise<void> => {
  try {
    const response = await fetch(
      "https://tigerbeer2025.azurewebsites.net/api/TigerCustomers/export-all-excel",
      { method: "GET" }
    );

    if (!response.ok) {
      let message = `HTTP ${response.status}`;
      try {
        const errorData: unknown = await response.json();
        if (typeof errorData === "object" && errorData !== null && "message" in errorData) {
          message = String((errorData as { message?: unknown }).message ?? message);
        }
      } catch { /* ignore */ }
      throw new Error(message);
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;

    // Lấy tên file từ Content-Disposition nếu có
    const cd = response.headers.get("content-disposition");
    let filename = `tiger_customers_all_${new Date().toISOString().split("T")[0]}.xlsx`;
    if (cd) {
      const match = cd.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (match) filename = match[1].replace(/['"]/g, "");
    }

    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
    alert((err as Error)?.message ?? "Không tải được file Excel.");
  }
};

const exportAndClearData = async (): Promise<void> => {
  const response = await fetch("https://tigerbeer2025.azurewebsites.net/api/TigerCustomers/export-and-clear-excel", {
    method: "POST",
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const errorData: unknown = await response.json();
      if (
        typeof errorData === "object" &&
        errorData !== null &&
        "message" in errorData
      ) {
        message = String((errorData as { message?: unknown }).message ?? message);
      }
    } catch {
      /* ignore JSON parse error */
    }
    throw new Error(message);
  }

  // Tải file
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;

  // Lấy tên file từ header hoặc tạo tên mặc định
  const cd = response.headers.get("content-disposition");
  let filename = `tiger_customers_${new Date().toISOString().split("T")[0]}.xlsx`;
  if (cd) {
    const match = cd.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (match) filename = match[1].replace(/['"]/g, "");
  }

  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const exportForUnity = async (): Promise<void> => {
  const response = await fetch("https://tigerbeer2025.azurewebsites.net/api/TigerCustomers/export-for-unity", {
    method: "GET",
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const errorData: unknown = await response.json();
      if (
        typeof errorData === "object" &&
        errorData !== null &&
        "message" in errorData
      ) {
        message = String((errorData as { message?: unknown }).message ?? message);
      }
    } catch {
      /* ignore JSON parse error */
    }
    throw new Error(message);
  }

  // Tải file
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;

  // Lấy tên file từ header hoặc tạo tên mặc định
  const cd = response.headers.get("content-disposition");
  let filename = `tiger_customers_unity_${new Date().toISOString().split("T")[0]}.xlsx`;
  if (cd) {
    const match = cd.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (match) filename = match[1].replace(/['"]/g, "");
  }

  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/* ---------- Component ---------- */
export default function AdminApp() {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [data, setData] = useState<TigerCustomer[]>([]);
  const [query, setQuery] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);
  const [filterWinner, setFilterWinner] = useState<FilterWinner>("all");
  const [sortField, setSortField] = useState<SortField>("joinedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Realtime states
  const [isRealtime, setIsRealtime] = useState<boolean>(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Reset states
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);

  // Unity export state
  const [isExportingUnity, setIsExportingUnity] = useState<boolean>(false);

  // Fetch dữ liệu
  const fetchData = async (showRefreshIndicator = false): Promise<void> => {
    try {
      if (showRefreshIndicator) setIsRefreshing(true);
      const list = await getCustomers();
      setData(list);
      setLastUpdate(new Date());
      setError("");
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Không tải được dữ liệu.";
      setError(msg);
    } finally {
      setLoading(false);
      if (showRefreshIndicator) setIsRefreshing(false);
    }
  };

  // Reset
  const handleReset = async (): Promise<void> => {
    if (!showResetConfirm) {
      setShowResetConfirm(true);
      return;
    }
    try {
      setIsResetting(true);
      await exportAndClearData();
      await fetchData();
      setShowResetConfirm(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Lỗi khi reset dữ liệu.";
      setError(msg);
    } finally {
      setIsResetting(false);
    }
  };

  // Unity Export
  const handleUnityExport = async (): Promise<void> => {
    try {
      setIsExportingUnity(true);
      await exportForUnity();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Lỗi khi xuất file Unity.";
      setError(msg);
    } finally {
      setIsExportingUnity(false);
    }
  };

  // Lần fetch đầu
  useEffect(() => {
    void fetchData();
  }, []);

  // Auto-refresh realtime
  useEffect(() => {
    if (!isRealtime) return;
    const interval = setInterval(() => {
      void fetchData(true);
    }, REALTIME_INTERVAL);
    return () => clearInterval(interval);
  }, [isRealtime]);

  // Manual refresh
  const handleManualRefresh = () => {
    void fetchData(true);
  };

  // Stats
  const stats: Stats = useMemo(() => {
    const total = data.length;
    const winners = data.filter((x) => !!x.reward).length;
    const now = new Date();
    const today = data.filter((x) =>
      isSameDayInVN(new Date(x.joinedAt), now)
    ).length;
    const thisWeek = data.filter((x) => {
      const joinDate = new Date(x.joinedAt);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return joinDate >= weekAgo;
    }).length;

    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const todayRegistrations = today;
    const yesterdayRegistrations = data.filter((x) =>
      isSameDayInVN(new Date(x.joinedAt), yesterday)
    ).length;
    const growthRate =
      yesterdayRegistrations > 0
        ? ((todayRegistrations - yesterdayRegistrations) /
          yesterdayRegistrations) *
        100
        : 0;

    return { total, winners, today, thisWeek, growthRate };
  }, [data]);

  // Filter + Sort
  const processedData = useMemo(() => {
    let filtered = [...data];

    // Text search
    const q = query.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter((x) => {
        return (
          x.fullName.toLowerCase().includes(q) ||
          x.phoneNumber.toLowerCase().includes(q)
        );
      });
    }

    // Winner filter
    if (filterWinner === "winner") {
      filtered = filtered.filter((x) => !!x.reward);
    } else if (filterWinner === "non-winner") {
      filtered = filtered.filter((x) => !x.reward);
    }

    // Sort (ổn định & typed)
    const comparator = (a: TigerCustomer, b: TigerCustomer): number => {
      let res = 0;
      if (sortField === "fullName") {
        res = a.fullName.localeCompare(b.fullName, "vi");
      } else if (sortField === "id") {
        res = a.id - b.id;
      } else {
        res =
          new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
      }
      return sortDirection === "asc" ? res : -res;
    };
    filtered.sort(comparator);

    return filtered;
  }, [data, query, filterWinner, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.max(
    1,
    Math.ceil(processedData.length / pageSize)
  );
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return processedData.slice(start, start + pageSize);
  }, [processedData, page, pageSize]);

  // CSV Export
  const exportToCSV = (): void => {
    const headers = [
      "ID",
      "Họ tên",
      "Số điện thoại",
      "Thời gian đăng ký",
      "Phần thưởng",
    ];
    const csvData = processedData.map((customer) => [
      customer.id,
      customer.fullName,
      customer.phoneNumber,
      formatVN(new Date(customer.joinedAt)),
      customer.reward ?? "",
    ]);

    const csvContent = [headers, ...csvData]
      .map((row) => row.map((field) => `"${String(field)}"`).join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `tiger-customers-${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSort = (field: SortField): void => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-sky-50 to-blue-50 overflow-x-hidden fixed inset-0">
      {/* Background Effects */}
      <BackgroundPattern />

      {/* Reset Confirmation Modal */}
      <AnimatePresence>
        {showResetConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Xác nhận Reset
                  </h3>
                  <p className="text-sm text-gray-600">
                    Hành động này không thể hoàn tác
                  </p>
                </div>
              </div>

              <p className="text-gray-700 mb-6">
                Bạn có chắc chắn muốn Reset? Dữ liệu người dùng nhận thưởng hiện tại sẽ bị vô hiệu hóa?
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  disabled={isResetting}
                >
                  Hủy
                </button>
                <button
                  onClick={handleReset}
                  disabled={isResetting}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {isResetting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Đang xử lý...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Xác nhận Reset
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="relative z-10 w-full max-w-none">
        {/* Header */}
        <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/95 border-b border-cyan-200/60 shadow-lg shadow-cyan-900/5">
          <div className="w-full px-3 sm:px-4 lg:px-6 xl:px-8">
            <div className="flex items-center justify-between h-14 sm:h-16 lg:h-20">
              {/* Logo & Title */}
              <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 min-w-0">
                <div className="relative flex-shrink-0">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-xl lg:rounded-2xl bg-gradient-to-br from-cyan-500 via-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
                    <span className="text-sm sm:text-xl lg:text-2xl">🐯</span>
                  </div>
                  <div className="absolute -top-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 bg-emerald-500 rounded-full border-2 border-white animate-pulse" />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-sm sm:text-xl lg:text-2xl xl:text-3xl font-black tracking-tight bg-gradient-to-r from-slate-800 via-slate-700 to-slate-600 bg-clip-text text-transparent truncate">
                    Tiger Analytics
                  </h1>
                  <p className="text-xs lg:text-sm text-slate-600 font-medium hidden sm:block">
                    Enterprise Dashboard
                  </p>
                </div>
              </div>

              {/* Desktop Controls */}
              <div className="hidden lg:flex items-center gap-4 xl:gap-6">
                <RealtimeControls
                  isRealtime={isRealtime}
                  onToggleRealtime={() => setIsRealtime((p) => !p)}
                  onManualRefresh={handleManualRefresh}
                  isRefreshing={isRefreshing}
                  lastUpdate={lastUpdate}
                />
                <div className="flex gap-2">
                  <StatusBadge label="Live" color="green" />
                  <StatusBadge label="v2.1" color="blue" />
                </div>
                <div className="flex gap-2">
                  <button className="w-8 h-8 xl:w-9 xl:h-9 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
                    <Bell className="w-4 h-4 text-slate-600" />
                  </button>
                  <button className="w-8 h-8 xl:w-9 xl:h-9 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
                    <Settings className="w-4 h-4 text-slate-600" />
                  </button>
                </div>
              </div>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen((p) => !p)}
                className="lg:hidden w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors flex-shrink-0"
              >
                {isMobileMenuOpen ? (
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                ) : (
                  <Menu className="w-4 h-4 sm:w-5 sm:h-5" />
                )}
              </button>
            </div>
          </div>
        </header>

        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              className="fixed top-14 sm:top-16 right-0 h-full w-72 sm:w-80 bg-white shadow-2xl z-50 lg:hidden overflow-y-auto"
            >
              <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
                <RealtimeControls
                  isRealtime={isRealtime}
                  onToggleRealtime={() => setIsRealtime((p) => !p)}
                  onManualRefresh={handleManualRefresh}
                  isRefreshing={isRefreshing}
                  lastUpdate={lastUpdate}
                />
                <div className="flex flex-col gap-2">
                  <StatusBadge label="Production Environment" color="green" />
                  <StatusBadge label="Version 2.1.0" color="blue" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <main className="w-full px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6 lg:space-y-8">
          {/* Stats */}
          <section className="w-full">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
              <EnhancedStatsCard
                icon={<Users className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7" />}
                title="Tổng đăng ký"
                value={loading ? "-" : stats.total.toLocaleString("vi-VN")}
                subtitle="Người dùng"
                trend={stats.total > 100 ? "+12%" : "Stable"}
                trendDirection="up"
                color="blue"
                gradient="from-cyan-600 to-blue-600"
              />
              <EnhancedStatsCard
                icon={<Trophy className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7" />}
                title="Người trúng thưởng"
                value={loading ? "-" : stats.winners.toLocaleString("vi-VN")}
                subtitle={`${stats.total > 0
                    ? ((stats.winners / stats.total) * 100).toFixed(1)
                    : 0
                  }% tổng số`}
                trend="Winner rate"
                color="green"
                gradient="from-emerald-600 to-teal-600"
              />
              <EnhancedStatsCard
                icon={<UserPlus className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7" />}
                title="Hôm nay"
                value={loading ? "-" : stats.today.toLocaleString("vi-VN")}
                subtitle="Đăng ký mới"
                trend={
                  stats.growthRate > 0
                    ? `+${stats.growthRate.toFixed(1)}%`
                    : stats.growthRate < 0
                      ? `${stats.growthRate.toFixed(1)}%`
                      : "0%"
                }
                trendDirection={
                  stats.growthRate > 0
                    ? "up"
                    : stats.growthRate < 0
                      ? "down"
                      : "neutral"
                }
                color="purple"
                gradient="from-violet-600 to-purple-600"
              />
              <EnhancedStatsCard
                icon={<BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7" />}
                title="Tuần này"
                value={loading ? "-" : stats.thisWeek.toLocaleString("vi-VN")}
                subtitle="7 ngày qua"
                trend="Weekly"
                color="orange"
                gradient="from-amber-600 to-orange-600"
              />
            </div>
          </section>

          {/* Controls */}
          <section className="w-full bg-white/80 backdrop-blur-sm rounded-xl lg:rounded-2xl border border-cyan-200/60 shadow-lg shadow-cyan-900/5">
            <div className="p-3 sm:p-4 lg:p-6">
              <div className="flex flex-col gap-3 sm:gap-4 lg:gap-6">
                {/* Search */}
                <div className="w-full">
                  <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2">
                    <Search className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1 sm:mr-2" />
                    Tìm kiếm khách hàng
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                    <input
                      placeholder="Nhập tên hoặc số điện thoại..."
                      className="w-full h-10 sm:h-11 lg:h-12 pl-10 sm:pl-12 pr-3 sm:pr-4 rounded-lg lg:rounded-xl border border-cyan-200 bg-white/90 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all outline-none text-sm lg:text-base"
                      value={query}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        setQuery(e.target.value);
                        setPage(1);
                      }}
                    />
                  </div>
                </div>

                {/* Filters & Actions */}
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2">
                      <Filter className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1 sm:mr-2" />
                      Trạng thái
                    </label>
                    <select
                      value={filterWinner}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                        setFilterWinner(e.target.value as FilterWinner);
                        setPage(1);
                      }}
                      className="w-full h-10 sm:h-11 lg:h-12 rounded-lg lg:rounded-xl border border-cyan-200 px-3 sm:px-4 bg-white/90 text-sm lg:text-base"
                    >
                      <option value="all">Tất cả khách hàng</option>
                      <option value="winner">🏆 Người trúng thưởng</option>
                      <option value="non-winner">👤 Chưa trúng thưởng</option>
                    </select>
                  </div>

                  <div className="flex-1 min-w-0 sm:max-w-32">
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-2">
                      Hiển thị
                    </label>
                    <select
                      value={pageSize}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                        setPageSize(Number(e.target.value));
                        setPage(1);
                      }}
                      className="w-full h-10 sm:h-11 lg:h-12 rounded-lg lg:rounded-xl border border-cyan-200 px-3 sm:px-4 bg-white/90 text-sm lg:text-base"
                    >
                      {PAGE_SIZE_OPTIONS.map((n) => (
                        <option key={n} value={n}>
                          {n} dòng
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-end gap-2 sm:gap-3">
                    {/* Export CSV Button */}
                    <motion.button
                      onClick={exportAllExcel}
                      disabled={loading}
                      className="flex-1 sm:flex-none h-10 sm:h-11 lg:h-12 px-3 sm:px-4 lg:px-6 rounded-lg lg:rounded-xl
             bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-semibold
             flex items-center justify-center gap-1 sm:gap-2
             hover:from-emerald-700 hover:to-teal-700
             disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all
             text-xs sm:text-sm lg:text-base"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      title="Tải toàn bộ dữ liệu Event ra Excel"
                    >
                      <FileSpreadsheet className="w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5" />
                      <span>Tải hết dữ liệu Event</span>
                    </motion.button>

                    {/* Unity Export Button */}
                    <motion.button
                      onClick={handleUnityExport}
                      disabled={loading || data.length === 0 || isExportingUnity}
                      className="flex-1 sm:flex-none h-10 sm:h-11 lg:h-12 px-3 sm:px-4 lg:px-6 rounded-lg lg:rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 text-white font-semibold flex items-center justify-center gap-1 sm:gap-2 hover:from-purple-700 hover:to-violet-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all text-xs sm:text-sm lg:text-base"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {isExportingUnity ? (
                        <>
                          <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5 animate-spin" />
                          <span>Unity...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5" />
                          <span>Unity</span>
                        </>
                      )}
                    </motion.button>

                    {/* Reset Button */}
                    <motion.button
                      onClick={() => setShowResetConfirm(true)}
                      disabled={loading || data.length === 0 || isResetting}
                      className="flex-1 sm:flex-none h-10 sm:h-11 lg:h-12 px-3 sm:px-4 lg:px-6 rounded-lg lg:rounded-xl bg-gradient-to-r from-red-600 to-red-700 text-white font-semibold flex items-center justify-center gap-1 sm:gap-2 hover:from-red-700 hover:to-red-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transition-all text-xs sm:text-sm lg:text-base"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {isResetting ? (
                        <>
                          <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5 animate-spin" />
                          <span>Reset...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5" />
                          <span>Reset</span>
                        </>
                      )}
                    </motion.button>
                  </div>
                </div>

                {/* Results Summary */}
                <div className="w-full">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs sm:text-sm bg-cyan-50 rounded-lg p-3 lg:p-4">
                    <div className="font-medium text-slate-900">
                      <span className="text-cyan-600 font-bold">
                        {paginatedData.length}
                      </span>{" "}
                      trong tổng số{" "}
                      <span className="text-cyan-600 font-bold">
                        {processedData.length.toLocaleString("vi-VN")}
                      </span>{" "}
                      bản ghi
                    </div>
                    <div className="flex flex-wrap gap-1 sm:gap-2 text-xs text-slate-600">
                      {query && (
                        <span className="bg-cyan-100 text-cyan-700 px-2 py-1 rounded-lg font-medium">
                          🔍 "{query}"
                        </span>
                      )}
                      {filterWinner !== "all" && (
                        <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg font-medium">
                          {filterWinner === "winner"
                            ? "🎁 Đã nhận quà"
                            : "👤 Chưa trúng"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Table */}
          <section className="w-full bg-white/80 backdrop-blur-sm rounded-xl lg:rounded-2xl border border-cyan-200/60 shadow-lg shadow-cyan-900/5 overflow-hidden">
            {/* Mobile */}
            <div className="lg:hidden">
              {loading ? (
                <div className="py-12 text-center">
                  <Loader2 className="inline w-6 h-6 sm:w-8 sm:h-8 animate-spin text-cyan-600 mb-3" />
                  <p className="text-slate-600 font-medium text-sm">
                    Đang tải dữ liệu...
                  </p>
                </div>
              ) : error ? (
                <div className="py-12 text-center text-red-600 font-medium text-sm">
                  {error}
                </div>
              ) : paginatedData.length === 0 ? (
                <div className="py-12 text-center text-slate-500 font-medium text-sm">
                  Không tìm thấy dữ liệu phù hợp
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {paginatedData.map((customer, index) => (
                    <motion.div
                      key={customer.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-3 sm:p-4 hover:bg-cyan-50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center flex-shrink-0">
                            <span className="font-bold text-slate-700 text-xs sm:text-sm">
                              #{customer.id}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-slate-900 text-sm sm:text-base truncate">
                              {customer.fullName}
                            </h3>
                            <RewardBadge reward={customer.reward} />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2 text-xs sm:text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 min-w-4">📞</span>
                          <a
                            href={`tel:${customer.phoneNumber}`}
                            className="text-cyan-600 hover:underline font-medium truncate"
                          >
                            {customer.phoneNumber}
                          </a>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 min-w-4">🕒</span>
                          <span className="text-slate-700 font-medium">
                            {formatVN(new Date(customer.joinedAt))}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Desktop */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full min-w-full">
                <thead className="bg-gradient-to-r from-cyan-50 to-blue-50 text-slate-700 sticky top-0">
                  <tr>
                    <SortableTableHeader
                      label="ID"
                      field="id"
                      currentSort={sortField}
                      direction={sortDirection}
                      onSort={handleSort}
                    />
                    <SortableTableHeader
                      label="Khách hàng"
                      field="fullName"
                      currentSort={sortField}
                      direction={sortDirection}
                      onSort={handleSort}
                    />
                    <Th>Số điện thoại</Th>
                    <SortableTableHeader
                      label="Thời gian đăng ký"
                      field="joinedAt"
                      currentSort={sortField}
                      direction={sortDirection}
                      onSort={handleSort}
                    />
                    <Th>Trạng thái</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/60">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-16 text-center">
                        <Loader2 className="inline w-8 h-8 animate-spin text-cyan-600 mb-4" />
                        <p className="text-slate-600 font-medium text-lg">
                          Đang tải dữ liệu...
                        </p>
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-16 text-center text-red-600 font-medium text-lg"
                      >
                        {error}
                      </td>
                    </tr>
                  ) : paginatedData.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-16 text-center text-slate-500 font-medium text-lg"
                      >
                        Không tìm thấy dữ liệu phù hợp
                      </td>
                    </tr>
                  ) : (
                    paginatedData.map((customer, index) => (
                      <motion.tr
                        key={customer.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.02 }}
                        className={`hover:bg-gradient-to-r hover:from-cyan-50/80 hover:to-blue-50/60 transition-all ${index % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                          }`}
                      >
                        <Td className="font-mono font-bold text-slate-800">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                              <span className="text-xs font-bold">
                                #{customer.id}
                              </span>
                            </div>
                          </div>
                        </Td>
                        <Td>
                          <div className="font-bold text-slate-900 text-base">
                            {customer.fullName}
                          </div>
                        </Td>
                        <Td>
                          <div className="space-y-1">
                            <div>
                              <a
                                href={`tel:${customer.phoneNumber}`}
                                className="text-cyan-600 hover:text-cyan-800 hover:underline font-medium transition-colors text-sm"
                              >
                                📞 {customer.phoneNumber}
                              </a>
                            </div>
                          </div>
                        </Td>
                        <Td className="font-medium text-slate-700">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-slate-400" />
                            {formatVN(new Date(customer.joinedAt))}
                          </div>
                        </Td>
                        <Td>
                          <RewardBadge reward={customer.reward} />
                        </Td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {!loading && !error && processedData.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between p-3 sm:p-4 lg:p-6 bg-gradient-to-r from-white to-cyan-50 border-t border-slate-100 gap-3 sm:gap-0">
                <div className="text-xs sm:text-sm text-slate-600 text-center sm:text-left">
                  <span className="font-semibold">
                    Trang {page} trên {totalPages}
                  </span>
                  <span className="mx-2 text-slate-400">•</span>
                  <span>
                    Tổng {processedData.length.toLocaleString("vi-VN")} bản ghi
                  </span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <PaginationButton onClick={() => setPage(1)} disabled={page <= 1}>
                    Đầu
                  </PaginationButton>
                  <PaginationButton
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    ‹
                  </PaginationButton>

                  {/* Page Numbers */}
                  <div className="flex items-center gap-1">
                    {Array.from(
                      { length: Math.min(5, totalPages) },
                      (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) pageNum = i + 1;
                        else if (page <= 3) pageNum = i + 1;
                        else if (page >= totalPages - 2)
                          pageNum = totalPages - 4 + i;
                        else pageNum = page - 2 + i;

                        return (
                          <button
                            key={pageNum}
                            onClick={() => setPage(pageNum)}
                            className={`w-7 h-7 sm:w-8 sm:h-8 lg:w-9 lg:h-9 rounded-lg text-xs sm:text-sm font-medium transition-all ${page === pageNum
                                ? "bg-cyan-600 text-white shadow-lg"
                                : "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200"
                              }`}
                          >
                            {pageNum}
                          </button>
                        );
                      }
                    )}
                  </div>

                  <PaginationButton
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    ›
                  </PaginationButton>
                  <PaginationButton
                    onClick={() => setPage(totalPages)}
                    disabled={page >= totalPages}
                  >
                    Cuối
                  </PaginationButton>
                </div>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

/* ---------- Enhanced Components ---------- */

function BackgroundPattern() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(6,182,212,0.1)_1px,transparent_0)] bg-[size:20px_20px] opacity-40" />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-32 h-64 w-64 rounded-full bg-gradient-to-tr from-cyan-400/20 via-blue-500/10 to-indigo-500/5 blur-3xl"
        animate={{ y: [0, -30, 0], scale: [1, 1.2, 1], rotate: [0, 120, 0] }}
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-32 h-64 w-64 rounded-full bg-gradient-to-tr from-blue-400/20 via-cyan-500/10 to-teal-500/5 blur-3xl"
        animate={{ y: [0, 30, 0], scale: [1, 1.1, 1], rotate: [0, -120, 0] }}
        transition={{ duration: 35, repeat: Infinity, ease: "easeInOut" }}
      />
    </>
  );
}

function RealtimeControls({
  isRealtime,
  onToggleRealtime,
  onManualRefresh,
  isRefreshing,
  lastUpdate,
}: {
  isRealtime: boolean;
  onToggleRealtime: () => void;
  onManualRefresh: () => void;
  isRefreshing: boolean;
  lastUpdate: Date;
}) {
  return (
    <div className="flex flex-col lg:flex-row items-start lg:items-center gap-2 lg:gap-3">
      <div className="flex items-center gap-2 lg:gap-3">
        <button
          onClick={onToggleRealtime}
          className={`flex items-center gap-1 lg:gap-2 px-2 lg:px-3 py-1.5 lg:py-2 rounded-lg border font-medium text-xs lg:text-sm transition-all ${isRealtime
              ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
              : "bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
            }`}
        >
          {isRealtime ? (
            <Wifi className="w-3 h-3 lg:w-4 lg:h-4" />
          ) : (
            <WifiOff className="w-3 h-3 lg:w-4 lg:h-4" />
          )}
          <span className="font-semibold">{isRealtime ? "LIVE" : "OFF"}</span>
        </button>

        <motion.button
          onClick={onManualRefresh}
          disabled={isRefreshing}
          className="w-7 h-7 lg:w-9 lg:h-9 rounded-lg bg-cyan-600 text-white hover:bg-cyan-700 disabled:opacity-50 transition-colors flex items-center justify-center"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <RefreshCw
            className={`w-3 h-3 lg:w-4 lg:h-4 ${isRefreshing ? "animate-spin" : ""
              }`}
          />
        </motion.button>
      </div>

      <div className="text-xs text-slate-500 bg-slate-50 px-2 lg:px-3 py-1 lg:py-1.5 rounded-lg">
        <span className="font-medium">Cập nhật:</span>{" "}
        {lastUpdate.toLocaleTimeString("vi-VN")}
      </div>
    </div>
  );
}

function StatusBadge({
  label,
  color,
}: {
  label: string;
  color: "green" | "blue";
}) {
  const colors: Record<"green" | "blue", string> = {
    green: "bg-emerald-100 text-emerald-700 border-emerald-200",
    blue: "bg-cyan-100 text-cyan-700 border-cyan-200",
  };

  return (
    <span
      className={`px-2 lg:px-3 py-1 lg:py-1.5 text-xs font-semibold rounded-full border ${colors[color]}`}
    >
      {label}
    </span>
  );
}

function EnhancedStatsCard({
  icon,
  title,
  value,
  subtitle,
  trend,
  trendDirection = "neutral",
  color, // chỉ để tạo className (tuỳ biến)
  gradient,
}: {
  icon: ReactNode;
  title: string;
  value: string | number;
  subtitle: string;
  trend?: string;
  trendDirection?: "up" | "down" | "neutral";
  color: string;
  gradient: string;
}) {
  const trendColors: Record<"up" | "down" | "neutral", string> = {
    up: "text-emerald-600 bg-emerald-50",
    down: "text-red-600 bg-red-50",
    neutral: "text-slate-600 bg-slate-50",
  };

  return (
    <motion.div
      className="relative bg-white/90 backdrop-blur-sm rounded-xl lg:rounded-2xl p-3 sm:p-4 lg:p-6 border border-cyan-200/60 shadow-lg shadow-cyan-900/5 hover:shadow-xl transition-all duration-300 overflow-hidden group"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
    >
      {/* Background Gradient */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-[0.02] group-hover:opacity-[0.05] transition-opacity`}
      />

      <div className="relative">
        <div className="flex items-start justify-between mb-3 sm:mb-4">
          <div
            className={`p-2 sm:p-2.5 lg:p-3 rounded-xl bg-gradient-to-br ${gradient} text-white shadow-lg`}
          >
            {icon}
          </div>
          {trend && (
            <div
              className={`flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-lg text-xs font-semibold ${trendColors[trendDirection]}`}
            >
              {trendDirection === "up" && (
                <TrendingUp className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              )}
              {trendDirection === "down" && (
                <TrendingUp className="w-2.5 h-2.5 sm:w-3 sm:h-3 rotate-180" />
              )}
              {trendDirection === "neutral" && (
                <Activity className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              )}
              <span className="hidden sm:inline">{trend}</span>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-xs sm:text-sm lg:text-base font-semibold text-slate-600 mb-1">
            {title}
          </h3>
          <div className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-black text-slate-900 mb-1 font-mono leading-tight">
            {value}
          </div>
          <p className="text-xs lg:text-sm text-slate-500 font-medium">
            {subtitle}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function SortableTableHeader({
  label,
  field,
  currentSort,
  direction,
  onSort,
}: {
  label: string;
  field: SortField;
  currentSort: SortField;
  direction: SortDirection;
  onSort: (field: SortField) => void;
}) {
  const isActive = currentSort === field;

  return (
    <th
      className="text-left font-bold px-4 lg:px-6 py-3 lg:py-4 whitespace-nowrap cursor-pointer hover:bg-cyan-100/80 transition-colors select-none group"
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1 lg:gap-2">
        <span className="group-hover:text-cyan-600 transition-colors text-sm lg:text-base">
          {label}
        </span>
        <div className="flex flex-col">
          <ChevronUp
            className={`w-3 h-3 -mb-1 transition-colors ${isActive && direction === "asc"
                ? "text-cyan-600"
                : "text-slate-400"
              }`}
          />
          <ChevronDown
            className={`w-3 h-3 transition-colors ${isActive && direction === "desc"
                ? "text-cyan-600"
                : "text-slate-400"
              }`}
          />
        </div>
      </div>
    </th>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th className="text-left font-bold px-4 lg:px-6 py-3 lg:py-4 whitespace-nowrap text-slate-700 text-sm lg:text-base">
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <td
      className={`px-4 lg:px-6 py-3 lg:py-4 align-middle text-sm lg:text-base ${className}`}
    >
      {children}
    </td>
  );
}

function RewardBadge({ reward }: { reward: string | null }) {
  if (reward) {
    return (
      <motion.span
        className="inline-flex items-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs font-bold bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/25"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.05 }}
        title={reward}
      >
        <Trophy className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1" />
        <span className="truncate max-w-20 sm:max-w-24">{reward}</span>
      </motion.span>
    );
  }

  return (
    <span className="inline-flex items-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
      <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-slate-400 mr-1" />
      Chưa trúng
    </span>
  );
}

function PaginationButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <motion.button
      className="px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white shadow-sm font-medium text-slate-700 transition-all text-xs sm:text-sm"
      onClick={onClick}
      disabled={disabled}
      whileHover={!disabled ? { scale: 1.05 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
    >
      {children}
    </motion.button>
  );
}
export interface TigerCustomer {
  id: number;
  fullName: string;
  phoneNumber: string;
  joinedAt: string; // ISO date string
  reward: string | null; // null nếu chưa trúng, khác null là tên phần quà
}

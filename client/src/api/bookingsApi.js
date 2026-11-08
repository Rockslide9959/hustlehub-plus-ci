import { apiRequest } from "./client";

export function createBooking(token, gigId) {
  return apiRequest("/api/bookings", {
    method: "POST",
    token,
    body: { gigId },
  });
}

export function getClientBookings(token) {
  return apiRequest("/api/bookings/my", { token });
}

export function getFreelancerBookings(token) {
  return apiRequest("/api/bookings/freelancer/my", { token });
}

export function getIncome(token) {
  return apiRequest("/api/transactions/income", { token });
}

export function getFreelancerTransactions(token) {
  return apiRequest("/api/transactions/my", { token });
}

export function getTaxSummary(token) {
  return apiRequest("/api/transactions/tax-summary", { token });
}

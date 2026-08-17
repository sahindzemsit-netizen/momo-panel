export const CARS: { id: number; name: string; plate: string }[] = [];

export const COUNTRY_COLORS: Record<string, string> = {
  Macedonia: "#64BC61",
  Kosovo: "#3B82F6",
  Albania: "#EC4899",
  Bosnia: "#8B5CF6",
  Montenegro: "#FF9F00",
  Serbia: "#7B3F00",
  Greece: "#4A4A4A",
  "ALL COUNTRIES": "#FACC15"
};

export const VEHICLE_COUNTRIES = ["Macedonia", "Kosovo", "Albania", "Bosnia", "Montenegro"];
export const AVAILABLE_COUNTRIES = Object.keys(COUNTRY_COLORS);

export const INSURANCE_OPTIONS = [
  { type: '800', price: 800, squares: 1, color: '#EF4444', label: '800 €' },
  { type: '2000', price: 2000, squares: 2, color: '#F97316', label: '2.000 €' },
  { type: '5000', price: 5000, squares: 3, color: '#10B981', label: '5.000 €' },
] as const;

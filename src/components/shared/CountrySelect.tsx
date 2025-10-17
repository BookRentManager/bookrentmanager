import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CountrySelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const COUNTRIES = [
  "Switzerland",
  "Germany",
  "France",
  "Italy",
  "Austria",
  "United Kingdom",
  "Spain",
  "Portugal",
  "Netherlands",
  "Belgium",
  "Luxembourg",
  "Denmark",
  "Sweden",
  "Norway",
  "Finland",
  "Poland",
  "Czech Republic",
  "Slovakia",
  "Hungary",
  "Romania",
  "Bulgaria",
  "Greece",
  "Croatia",
  "Slovenia",
  "Serbia",
  "Ireland",
  "United States",
  "Canada",
  "Australia",
  "New Zealand",
  "Japan",
  "China",
  "India",
  "Brazil",
  "Mexico",
  "Argentina",
  "Chile",
  "South Africa",
  "Egypt",
  "United Arab Emirates",
  "Saudi Arabia",
  "Turkey",
  "Russia",
  "Other"
];

export function CountrySelect({ value, onChange, placeholder, disabled }: CountrySelectProps) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder || "Select country"} />
      </SelectTrigger>
      <SelectContent className="max-h-[300px]">
        {COUNTRIES.map((country) => (
          <SelectItem key={country} value={country}>
            {country}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

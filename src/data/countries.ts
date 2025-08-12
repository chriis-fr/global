export interface Country {
  code: string;
  name: string;
  phoneCode: string;
  flag?: string;
  hasBanks?: boolean;
  taxes?: {
    vat?: number;
    gst?: number;
    salesTax?: number;
    corporateTax?: number;
    personalTax?: number;
  };
}

export const countries: Country[] = [
  // North America
  { code: 'US', name: 'United States', phoneCode: '+1', taxes: { salesTax: 0, corporateTax: 21, personalTax: 37 } },
  { code: 'CA', name: 'Canada', phoneCode: '+1', taxes: { gst: 5, corporateTax: 15, personalTax: 33 } },
  { code: 'MX', name: 'Mexico', phoneCode: '+52', taxes: { vat: 16, corporateTax: 30, personalTax: 35 } },
  
  // Europe
  { code: 'GB', name: 'United Kingdom', phoneCode: '+44', taxes: { vat: 20, corporateTax: 19, personalTax: 45 } },
  { code: 'DE', name: 'Germany', phoneCode: '+49', taxes: { vat: 19, corporateTax: 15.825, personalTax: 45 } },
  { code: 'FR', name: 'France', phoneCode: '+33', taxes: { vat: 20, corporateTax: 25, personalTax: 45 } },
  { code: 'IT', name: 'Italy', phoneCode: '+39', taxes: { vat: 22, corporateTax: 24, personalTax: 43 } },
  { code: 'ES', name: 'Spain', phoneCode: '+34', taxes: { vat: 21, corporateTax: 25, personalTax: 47 } },
  { code: 'NL', name: 'Netherlands', phoneCode: '+31', taxes: { vat: 21, corporateTax: 25.8, personalTax: 52 } },
  { code: 'BE', name: 'Belgium', phoneCode: '+32', taxes: { vat: 21, corporateTax: 25, personalTax: 50 } },
  { code: 'CH', name: 'Switzerland', phoneCode: '+41', taxes: { vat: 7.7, corporateTax: 18.5, personalTax: 41.5 } },
  { code: 'AT', name: 'Austria', phoneCode: '+43', taxes: { vat: 20, corporateTax: 25, personalTax: 55 } },
  { code: 'SE', name: 'Sweden', phoneCode: '+46', taxes: { vat: 25, corporateTax: 20.6, personalTax: 57.2 } },
  { code: 'NO', name: 'Norway', phoneCode: '+47', taxes: { vat: 25, corporateTax: 22, personalTax: 38.2 } },
  { code: 'DK', name: 'Denmark', phoneCode: '+45', taxes: { vat: 25, corporateTax: 22, personalTax: 55.9 } },
  { code: 'FI', name: 'Finland', phoneCode: '+358', taxes: { vat: 24, corporateTax: 20, personalTax: 31.25 } },
  { code: 'PL', name: 'Poland', phoneCode: '+48', taxes: { vat: 23, corporateTax: 19, personalTax: 32 } },
  { code: 'CZ', name: 'Czech Republic', phoneCode: '+420', taxes: { vat: 21, corporateTax: 19, personalTax: 23 } },
  { code: 'HU', name: 'Hungary', phoneCode: '+36', taxes: { vat: 27, corporateTax: 9, personalTax: 15 } },
  { code: 'RO', name: 'Romania', phoneCode: '+40', taxes: { vat: 19, corporateTax: 16, personalTax: 10 } },
  { code: 'BG', name: 'Bulgaria', phoneCode: '+359', taxes: { vat: 20, corporateTax: 10, personalTax: 10 } },
  { code: 'HR', name: 'Croatia', phoneCode: '+385', taxes: { vat: 25, corporateTax: 18, personalTax: 30 } },
  { code: 'SI', name: 'Slovenia', phoneCode: '+386', taxes: { vat: 22, corporateTax: 19, personalTax: 50 } },
  { code: 'SK', name: 'Slovakia', phoneCode: '+421', taxes: { vat: 20, corporateTax: 21, personalTax: 25 } },
  { code: 'LT', name: 'Lithuania', phoneCode: '+370', taxes: { vat: 21, corporateTax: 15, personalTax: 20 } },
  { code: 'LV', name: 'Latvia', phoneCode: '+371', taxes: { vat: 21, corporateTax: 20, personalTax: 31 } },
  { code: 'EE', name: 'Estonia', phoneCode: '+372', taxes: { vat: 20, corporateTax: 20, personalTax: 20 } },
  { code: 'IE', name: 'Ireland', phoneCode: '+353', taxes: { vat: 23, corporateTax: 12.5, personalTax: 40 } },
  { code: 'PT', name: 'Portugal', phoneCode: '+351', taxes: { vat: 23, corporateTax: 21, personalTax: 48 } },
  { code: 'GR', name: 'Greece', phoneCode: '+30', taxes: { vat: 24, corporateTax: 22, personalTax: 44 } },
  { code: 'CY', name: 'Cyprus', phoneCode: '+357', taxes: { vat: 19, corporateTax: 12.5, personalTax: 35 } },
  { code: 'MT', name: 'Malta', phoneCode: '+356', taxes: { vat: 18, corporateTax: 35, personalTax: 35 } },
  { code: 'LU', name: 'Luxembourg', phoneCode: '+352', taxes: { vat: 17, corporateTax: 24.94, personalTax: 42 } },
  { code: 'IS', name: 'Iceland', phoneCode: '+354', taxes: { vat: 24, corporateTax: 20, personalTax: 46.24 } },
  { code: 'TR', name: 'Turkey', phoneCode: '+90', taxes: { vat: 18, corporateTax: 20, personalTax: 40 } },
  { code: 'RU', name: 'Russia', phoneCode: '+7', taxes: { vat: 20, corporateTax: 20, personalTax: 13 } },
  { code: 'UA', name: 'Ukraine', phoneCode: '+380', taxes: { vat: 20, corporateTax: 18, personalTax: 18 } },
  { code: 'BY', name: 'Belarus', phoneCode: '+375', taxes: { vat: 20, corporateTax: 18, personalTax: 13 } },
  { code: 'MD', name: 'Moldova', phoneCode: '+373', taxes: { vat: 20, corporateTax: 12, personalTax: 12 } },
  { code: 'GE', name: 'Georgia', phoneCode: '+995', taxes: { vat: 18, corporateTax: 15, personalTax: 20 } },
  { code: 'AM', name: 'Armenia', phoneCode: '+374', taxes: { vat: 20, corporateTax: 18, personalTax: 23 } },
  { code: 'AZ', name: 'Azerbaijan', phoneCode: '+994', taxes: { vat: 18, corporateTax: 20, personalTax: 25 } },
  { code: 'KZ', name: 'Kazakhstan', phoneCode: '+7', taxes: { vat: 12, corporateTax: 20, personalTax: 10 } },
  { code: 'UZ', name: 'Uzbekistan', phoneCode: '+998', taxes: { vat: 15, corporateTax: 12, personalTax: 12 } },
  { code: 'KG', name: 'Kyrgyzstan', phoneCode: '+996', taxes: { vat: 12, corporateTax: 10, personalTax: 10 } },
  { code: 'TJ', name: 'Tajikistan', phoneCode: '+992', taxes: { vat: 18, corporateTax: 13, personalTax: 13 } },
  { code: 'TM', name: 'Turkmenistan', phoneCode: '+993', taxes: { vat: 20, corporateTax: 8, personalTax: 8 } },
  { code: 'AL', name: 'Albania', phoneCode: '+355', taxes: { vat: 20, corporateTax: 15, personalTax: 23 } },
  { code: 'MK', name: 'North Macedonia', phoneCode: '+389', taxes: { vat: 18, corporateTax: 10, personalTax: 10 } },
  { code: 'ME', name: 'Montenegro', phoneCode: '+382', taxes: { vat: 21, corporateTax: 9, personalTax: 9 } },
  { code: 'RS', name: 'Serbia', phoneCode: '+381', taxes: { vat: 20, corporateTax: 15, personalTax: 15 } },
  { code: 'BA', name: 'Bosnia and Herzegovina', phoneCode: '+387', taxes: { vat: 17, corporateTax: 10, personalTax: 10 } },
  { code: 'XK', name: 'Kosovo', phoneCode: '+383', taxes: { vat: 18, corporateTax: 10, personalTax: 10 } },
  { code: 'AD', name: 'Andorra', phoneCode: '+376', taxes: { vat: 4.5, corporateTax: 10, personalTax: 10 } },
  { code: 'MC', name: 'Monaco', phoneCode: '+377', taxes: { vat: 20, corporateTax: 33.33, personalTax: 0 } },
  { code: 'LI', name: 'Liechtenstein', phoneCode: '+423', taxes: { vat: 7.7, corporateTax: 12.5, personalTax: 8 } },
  { code: 'SM', name: 'San Marino', phoneCode: '+378', taxes: { vat: 0, corporateTax: 17, personalTax: 35 } },
  { code: 'VA', name: 'Vatican City', phoneCode: '+379', taxes: { vat: 0, corporateTax: 0, personalTax: 0 } },
  { code: 'FO', name: 'Faroe Islands', phoneCode: '+298', taxes: { vat: 25, corporateTax: 18, personalTax: 42 } },
  { code: 'GL', name: 'Greenland', phoneCode: '+299', taxes: { vat: 0, corporateTax: 0, personalTax: 0 } },
  { code: 'AX', name: 'Åland Islands', phoneCode: '+358', taxes: { vat: 24, corporateTax: 20, personalTax: 31.25 } },
  { code: 'SJ', name: 'Svalbard and Jan Mayen', phoneCode: '+47', taxes: { vat: 25, corporateTax: 22, personalTax: 38.2 } },
  
  // Asia
  { code: 'CN', name: 'China', phoneCode: '+86', taxes: { vat: 13, corporateTax: 25, personalTax: 45 } },
  { code: 'JP', name: 'Japan', phoneCode: '+81', taxes: { vat: 10, corporateTax: 23.2, personalTax: 45 } },
  { code: 'KR', name: 'South Korea', phoneCode: '+82', taxes: { vat: 10, corporateTax: 25, personalTax: 45 } },
  { code: 'IN', name: 'India', phoneCode: '+91', taxes: { gst: 18, corporateTax: 30, personalTax: 30 } },
  { code: 'PK', name: 'Pakistan', phoneCode: '+92', taxes: { vat: 17, corporateTax: 29, personalTax: 35 } },
  { code: 'BD', name: 'Bangladesh', phoneCode: '+880', taxes: { vat: 15, corporateTax: 25, personalTax: 25 } },
  { code: 'LK', name: 'Sri Lanka', phoneCode: '+94', taxes: { vat: 15, corporateTax: 24, personalTax: 18 } },
  { code: 'NP', name: 'Nepal', phoneCode: '+977', taxes: { vat: 13, corporateTax: 25, personalTax: 25 } },
  { code: 'BT', name: 'Bhutan', phoneCode: '+975', taxes: { vat: 0, corporateTax: 30, personalTax: 30 } },
  { code: 'MV', name: 'Maldives', phoneCode: '+960', taxes: { vat: 6, corporateTax: 15, personalTax: 15 } },
  { code: 'MM', name: 'Myanmar', phoneCode: '+95', taxes: { vat: 5, corporateTax: 25, personalTax: 25 } },
  { code: 'TH', name: 'Thailand', phoneCode: '+66', taxes: { vat: 7, corporateTax: 20, personalTax: 35 } },
  { code: 'VN', name: 'Vietnam', phoneCode: '+84', taxes: { vat: 10, corporateTax: 20, personalTax: 35 } },
  { code: 'LA', name: 'Laos', phoneCode: '+856', taxes: { vat: 10, corporateTax: 20, personalTax: 24 } },
  { code: 'KH', name: 'Cambodia', phoneCode: '+855', taxes: { vat: 10, corporateTax: 20, personalTax: 20 } },
  { code: 'MY', name: 'Malaysia', phoneCode: '+60', taxes: { vat: 10, corporateTax: 24, personalTax: 30 } },
  { code: 'SG', name: 'Singapore', phoneCode: '+65', taxes: { vat: 7, corporateTax: 17, personalTax: 22 } },
  { code: 'ID', name: 'Indonesia', phoneCode: '+62', taxes: { vat: 11, corporateTax: 22, personalTax: 35 } },
  { code: 'PH', name: 'Philippines', phoneCode: '+63', taxes: { vat: 12, corporateTax: 25, personalTax: 35 } },
  { code: 'BN', name: 'Brunei', phoneCode: '+673', taxes: { vat: 0, corporateTax: 18.5, personalTax: 0 } },
  { code: 'TL', name: 'East Timor', phoneCode: '+670', taxes: { vat: 0, corporateTax: 10, personalTax: 10 } },
  { code: 'MN', name: 'Mongolia', phoneCode: '+976', taxes: { vat: 10, corporateTax: 10, personalTax: 10 } },
  { code: 'KP', name: 'North Korea', phoneCode: '+850', taxes: { vat: 0, corporateTax: 0, personalTax: 0 } },
  { code: 'TW', name: 'Taiwan', phoneCode: '+886', taxes: { vat: 5, corporateTax: 20, personalTax: 40 } },
  { code: 'HK', name: 'Hong Kong', phoneCode: '+852', taxes: { vat: 0, corporateTax: 16.5, personalTax: 17 } },
  { code: 'MO', name: 'Macau', phoneCode: '+853', taxes: { vat: 0, corporateTax: 12, personalTax: 12 } },
  { code: 'AF', name: 'Afghanistan', phoneCode: '+93', taxes: { vat: 0, corporateTax: 20, personalTax: 20 } },
  { code: 'IL', name: 'Israel', phoneCode: '+972', taxes: { vat: 17, corporateTax: 23, personalTax: 50 } },
  { code: 'LB', name: 'Lebanon', phoneCode: '+961', taxes: { vat: 11, corporateTax: 17, personalTax: 25 } },
  { code: 'SY', name: 'Syria', phoneCode: '+963', taxes: { vat: 0, corporateTax: 28, personalTax: 22 } },
  { code: 'JO', name: 'Jordan', phoneCode: '+962', taxes: { vat: 16, corporateTax: 20, personalTax: 25 } },
  { code: 'IQ', name: 'Iraq', phoneCode: '+964', taxes: { vat: 0, corporateTax: 15, personalTax: 15 } },
  { code: 'IR', name: 'Iran', phoneCode: '+98', taxes: { vat: 9, corporateTax: 25, personalTax: 35 } },
  { code: 'KW', name: 'Kuwait', phoneCode: '+965', taxes: { vat: 0, corporateTax: 15, personalTax: 0 } },
  { code: 'SA', name: 'Saudi Arabia', phoneCode: '+966', taxes: { vat: 15, corporateTax: 20, personalTax: 0 } },
  { code: 'AE', name: 'United Arab Emirates', phoneCode: '+971', taxes: { vat: 5, corporateTax: 9, personalTax: 0 } },
  { code: 'QA', name: 'Qatar', phoneCode: '+974', taxes: { vat: 0, corporateTax: 10, personalTax: 0 } },
  { code: 'BH', name: 'Bahrain', phoneCode: '+973', taxes: { vat: 5, corporateTax: 0, personalTax: 0 } },
  { code: 'OM', name: 'Oman', phoneCode: '+968', taxes: { vat: 5, corporateTax: 15, personalTax: 0 } },
  { code: 'YE', name: 'Yemen', phoneCode: '+967', taxes: { vat: 5, corporateTax: 20, personalTax: 20 } },
  { code: 'PS', name: 'Palestine', phoneCode: '+970', taxes: { vat: 16, corporateTax: 15, personalTax: 15 } },
  
  // Africa
  { code: 'ZA', name: 'South Africa', phoneCode: '+27', taxes: { vat: 15, corporateTax: 28, personalTax: 45 } },
  { code: 'EG', name: 'Egypt', phoneCode: '+20', taxes: { vat: 14, corporateTax: 22.5, personalTax: 25 } },
  { code: 'NG', name: 'Nigeria', phoneCode: '+234', taxes: { vat: 7.5, corporateTax: 30, personalTax: 24 } },
  { code: 'KE', name: 'Kenya', phoneCode: '+254', hasBanks: true, taxes: { vat: 16, corporateTax: 30, personalTax: 30 } },
  { code: 'GH', name: 'Ghana', phoneCode: '+233', hasBanks: true, taxes: { vat: 12.5, corporateTax: 25, personalTax: 35 } },
  { code: 'ET', name: 'Ethiopia', phoneCode: '+251', taxes: { vat: 15, corporateTax: 30, personalTax: 35 } },
  { code: 'TZ', name: 'Tanzania', phoneCode: '+255', taxes: { vat: 18, corporateTax: 30, personalTax: 30 } },
  { code: 'UG', name: 'Uganda', phoneCode: '+256', taxes: { vat: 18, corporateTax: 30, personalTax: 40 } },
  { code: 'DZ', name: 'Algeria', phoneCode: '+213', taxes: { vat: 19, corporateTax: 26, personalTax: 35 } },
  { code: 'MA', name: 'Morocco', phoneCode: '+212', taxes: { vat: 20, corporateTax: 31, personalTax: 38 } },
  { code: 'TN', name: 'Tunisia', phoneCode: '+216', taxes: { vat: 19, corporateTax: 25, personalTax: 35 } },
  { code: 'LY', name: 'Libya', phoneCode: '+218', taxes: { vat: 0, corporateTax: 20, personalTax: 10 } },
  { code: 'SD', name: 'Sudan', phoneCode: '+249', taxes: { vat: 0, corporateTax: 30, personalTax: 30 } },
  { code: 'CM', name: 'Cameroon', phoneCode: '+237', taxes: { vat: 19.25, corporateTax: 33, personalTax: 35 } },
  { code: 'CI', name: 'Ivory Coast', phoneCode: '+225', taxes: { vat: 18, corporateTax: 25, personalTax: 60 } },
  { code: 'SN', name: 'Senegal', phoneCode: '+221', taxes: { vat: 18, corporateTax: 30, personalTax: 40 } },
  { code: 'ML', name: 'Mali', phoneCode: '+223', taxes: { vat: 18, corporateTax: 30, personalTax: 40 } },
  { code: 'BF', name: 'Burkina Faso', phoneCode: '+226', taxes: { vat: 18, corporateTax: 27.5, personalTax: 25 } },
  { code: 'NE', name: 'Niger', phoneCode: '+227', taxes: { vat: 19, corporateTax: 30, personalTax: 35 } },
  { code: 'TD', name: 'Chad', phoneCode: '+235', taxes: { vat: 18, corporateTax: 35, personalTax: 60 } },
  { code: 'CF', name: 'Central African Republic', phoneCode: '+236', taxes: { vat: 19, corporateTax: 30, personalTax: 50 } },
  { code: 'CG', name: 'Republic of the Congo', phoneCode: '+242', taxes: { vat: 18.9, corporateTax: 28, personalTax: 46 } },
  { code: 'CD', name: 'Democratic Republic of the Congo', phoneCode: '+243', taxes: { vat: 16, corporateTax: 35, personalTax: 40 } },
  { code: 'GA', name: 'Gabon', phoneCode: '+241', taxes: { vat: 18, corporateTax: 30, personalTax: 35 } },
  { code: 'GQ', name: 'Equatorial Guinea', phoneCode: '+240', taxes: { vat: 15, corporateTax: 35, personalTax: 35 } },
  { code: 'ST', name: 'São Tomé and Príncipe', phoneCode: '+239', taxes: { vat: 0, corporateTax: 25, personalTax: 20 } },
  { code: 'GW', name: 'Guinea-Bissau', phoneCode: '+245', taxes: { vat: 15, corporateTax: 25, personalTax: 25 } },
  { code: 'GN', name: 'Guinea', phoneCode: '+224', taxes: { vat: 18, corporateTax: 35, personalTax: 40 } },
  { code: 'SL', name: 'Sierra Leone', phoneCode: '+232', taxes: { vat: 15, corporateTax: 30, personalTax: 35 } },
  { code: 'LR', name: 'Liberia', phoneCode: '+231', taxes: { vat: 10, corporateTax: 25, personalTax: 25 } },
  { code: 'TG', name: 'Togo', phoneCode: '+228', taxes: { vat: 18, corporateTax: 28, personalTax: 43 } },
  { code: 'BJ', name: 'Benin', phoneCode: '+229', taxes: { vat: 18, corporateTax: 30, personalTax: 35 } },
  { code: 'RW', name: 'Rwanda', phoneCode: '+250', taxes: { vat: 18, corporateTax: 30, personalTax: 30 } },
  { code: 'BI', name: 'Burundi', phoneCode: '+257', taxes: { vat: 18, corporateTax: 30, personalTax: 35 } },
  { code: 'MZ', name: 'Mozambique', phoneCode: '+258', taxes: { vat: 17, corporateTax: 32, personalTax: 32 } },
  { code: 'ZW', name: 'Zimbabwe', phoneCode: '+263', taxes: { vat: 14.5, corporateTax: 24.72, personalTax: 40 } },
  { code: 'ZM', name: 'Zambia', phoneCode: '+260', taxes: { vat: 16, corporateTax: 30, personalTax: 37.5 } },
  { code: 'MW', name: 'Malawi', phoneCode: '+265', taxes: { vat: 16.5, corporateTax: 30, personalTax: 30 } },
  { code: 'BW', name: 'Botswana', phoneCode: '+267', taxes: { vat: 12, corporateTax: 22, personalTax: 25 } },
  { code: 'NA', name: 'Namibia', phoneCode: '+264', taxes: { vat: 15, corporateTax: 32, personalTax: 37 } },
  { code: 'LS', name: 'Lesotho', phoneCode: '+266', taxes: { vat: 15, corporateTax: 25, personalTax: 35 } },
  { code: 'SZ', name: 'Eswatini', phoneCode: '+268', taxes: { vat: 15, corporateTax: 27.5, personalTax: 33 } },
  { code: 'MG', name: 'Madagascar', phoneCode: '+261', taxes: { vat: 20, corporateTax: 20, personalTax: 20 } },
  { code: 'MU', name: 'Mauritius', phoneCode: '+230', taxes: { vat: 15, corporateTax: 15, personalTax: 15 } },
  { code: 'SC', name: 'Seychelles', phoneCode: '+248', taxes: { vat: 15, corporateTax: 33, personalTax: 15 } },
  { code: 'KM', name: 'Comoros', phoneCode: '+269', taxes: { vat: 0, corporateTax: 50, personalTax: 0 } },
  { code: 'DJ', name: 'Djibouti', phoneCode: '+253', taxes: { vat: 10, corporateTax: 25, personalTax: 30 } },
  { code: 'SO', name: 'Somalia', phoneCode: '+252', taxes: { vat: 0, corporateTax: 0, personalTax: 0 } },
  { code: 'ER', name: 'Eritrea', phoneCode: '+291', taxes: { vat: 0, corporateTax: 30, personalTax: 30 } },
  { code: 'SS', name: 'South Sudan', phoneCode: '+211', taxes: { vat: 0, corporateTax: 0, personalTax: 0 } },
  
  // Oceania
  { code: 'AU', name: 'Australia', phoneCode: '+61', taxes: { vat: 10, corporateTax: 30, personalTax: 45 } },
  { code: 'NZ', name: 'New Zealand', phoneCode: '+64', taxes: { vat: 15, corporateTax: 28, personalTax: 39 } },
  { code: 'FJ', name: 'Fiji', phoneCode: '+679', taxes: { vat: 9, corporateTax: 20, personalTax: 20 } },
  { code: 'PG', name: 'Papua New Guinea', phoneCode: '+675', taxes: { vat: 10, corporateTax: 30, personalTax: 42 } },
  { code: 'SB', name: 'Solomon Islands', phoneCode: '+677', taxes: { vat: 10, corporateTax: 30, personalTax: 30 } },
  { code: 'VU', name: 'Vanuatu', phoneCode: '+678', taxes: { vat: 0, corporateTax: 0, personalTax: 0 } },
  { code: 'NC', name: 'New Caledonia', phoneCode: '+687', taxes: { vat: 0, corporateTax: 0, personalTax: 0 } },
  { code: 'PF', name: 'French Polynesia', phoneCode: '+689', taxes: { vat: 0, corporateTax: 0, personalTax: 0 } },
  { code: 'TO', name: 'Tonga', phoneCode: '+676', taxes: { vat: 15, corporateTax: 25, personalTax: 25 } },
  { code: 'WS', name: 'Samoa', phoneCode: '+685', taxes: { vat: 15, corporateTax: 27, personalTax: 27 } },
  { code: 'KI', name: 'Kiribati', phoneCode: '+686', taxes: { vat: 0, corporateTax: 30, personalTax: 30 } },
  { code: 'TV', name: 'Tuvalu', phoneCode: '+688', taxes: { vat: 0, corporateTax: 0, personalTax: 0 } },
  { code: 'NR', name: 'Nauru', phoneCode: '+674', taxes: { vat: 0, corporateTax: 0, personalTax: 0 } },
  { code: 'PW', name: 'Palau', phoneCode: '+680', taxes: { vat: 0, corporateTax: 0, personalTax: 0 } },
  { code: 'FM', name: 'Micronesia', phoneCode: '+691', taxes: { vat: 0, corporateTax: 0, personalTax: 0 } },
  { code: 'MH', name: 'Marshall Islands', phoneCode: '+692', taxes: { vat: 0, corporateTax: 0, personalTax: 0 } },
  
  // South America
  { code: 'BR', name: 'Brazil', phoneCode: '+55', taxes: { vat: 17, corporateTax: 34, personalTax: 27.5 } },
  { code: 'AR', name: 'Argentina', phoneCode: '+54', taxes: { vat: 21, corporateTax: 30, personalTax: 35 } },
  { code: 'CL', name: 'Chile', phoneCode: '+56', taxes: { vat: 19, corporateTax: 27, personalTax: 40 } },
  { code: 'CO', name: 'Colombia', phoneCode: '+57', taxes: { vat: 19, corporateTax: 35, personalTax: 39 } },
  { code: 'PE', name: 'Peru', phoneCode: '+51', taxes: { vat: 18, corporateTax: 29.5, personalTax: 30 } },
  { code: 'VE', name: 'Venezuela', phoneCode: '+58', taxes: { vat: 16, corporateTax: 34, personalTax: 34 } },
  { code: 'EC', name: 'Ecuador', phoneCode: '+593', taxes: { vat: 12, corporateTax: 25, personalTax: 35 } },
  { code: 'BO', name: 'Bolivia', phoneCode: '+591', taxes: { vat: 13, corporateTax: 25, personalTax: 13 } },
  { code: 'PY', name: 'Paraguay', phoneCode: '+595', taxes: { vat: 10, corporateTax: 10, personalTax: 10 } },
  { code: 'UY', name: 'Uruguay', phoneCode: '+598', taxes: { vat: 22, corporateTax: 25, personalTax: 36 } },
  { code: 'GY', name: 'Guyana', phoneCode: '+592', taxes: { vat: 16, corporateTax: 25, personalTax: 40 } },
  { code: 'SR', name: 'Suriname', phoneCode: '+597', taxes: { vat: 10, corporateTax: 36, personalTax: 38 } },
  { code: 'FK', name: 'Falkland Islands', phoneCode: '+500', taxes: { vat: 0, corporateTax: 0, personalTax: 0 } },
  { code: 'GF', name: 'French Guiana', phoneCode: '+594', taxes: { vat: 0, corporateTax: 0, personalTax: 0 } },
  
  // Central America & Caribbean
  { code: 'GT', name: 'Guatemala', phoneCode: '+502', taxes: { vat: 12, corporateTax: 25, personalTax: 7 } },
  { code: 'BZ', name: 'Belize', phoneCode: '+501', taxes: { vat: 12.5, corporateTax: 25, personalTax: 25 } },
  { code: 'SV', name: 'El Salvador', phoneCode: '+503', taxes: { vat: 13, corporateTax: 30, personalTax: 30 } },
  { code: 'HN', name: 'Honduras', phoneCode: '+504', taxes: { vat: 15, corporateTax: 25, personalTax: 25 } },
  { code: 'NI', name: 'Nicaragua', phoneCode: '+505', taxes: { vat: 15, corporateTax: 30, personalTax: 30 } },
  { code: 'CR', name: 'Costa Rica', phoneCode: '+506', taxes: { vat: 13, corporateTax: 30, personalTax: 15 } },
  { code: 'PA', name: 'Panama', phoneCode: '+507', taxes: { vat: 7, corporateTax: 25, personalTax: 25 } },
  { code: 'CU', name: 'Cuba', phoneCode: '+53', taxes: { vat: 0, corporateTax: 35, personalTax: 50 } },
  { code: 'JM', name: 'Jamaica', phoneCode: '+1876', taxes: { vat: 15, corporateTax: 25, personalTax: 25 } },
  { code: 'HT', name: 'Haiti', phoneCode: '+509', taxes: { vat: 10, corporateTax: 30, personalTax: 30 } },
  { code: 'DO', name: 'Dominican Republic', phoneCode: '+1809', taxes: { vat: 18, corporateTax: 27, personalTax: 25 } },
  { code: 'PR', name: 'Puerto Rico', phoneCode: '+1787', taxes: { vat: 11.5, corporateTax: 37.5, personalTax: 33 } },
  { code: 'TT', name: 'Trinidad and Tobago', phoneCode: '+1868', taxes: { vat: 12.5, corporateTax: 30, personalTax: 25 } },
  { code: 'BB', name: 'Barbados', phoneCode: '+1246', taxes: { vat: 17.5, corporateTax: 5.5, personalTax: 33.5 } },
  { code: 'GD', name: 'Grenada', phoneCode: '+1473', taxes: { vat: 15, corporateTax: 30, personalTax: 30 } },
  { code: 'LC', name: 'Saint Lucia', phoneCode: '+1758', taxes: { vat: 12.5, corporateTax: 30, personalTax: 30 } },
  { code: 'VC', name: 'Saint Vincent and the Grenadines', phoneCode: '+1784', taxes: { vat: 15, corporateTax: 32.5, personalTax: 32.5 } },
  { code: 'AG', name: 'Antigua and Barbuda', phoneCode: '+1268', taxes: { vat: 15, corporateTax: 25, personalTax: 25 } },
  { code: 'KN', name: 'Saint Kitts and Nevis', phoneCode: '+1869', taxes: { vat: 0, corporateTax: 0, personalTax: 0 } },
  { code: 'DM', name: 'Dominica', phoneCode: '+1767', taxes: { vat: 15, corporateTax: 25, personalTax: 25 } },
  { code: 'BS', name: 'Bahamas', phoneCode: '+1242', taxes: { vat: 0, corporateTax: 0, personalTax: 0 } },
  { code: 'TC', name: 'Turks and Caicos Islands', phoneCode: '+1649', taxes: { vat: 0, corporateTax: 0, personalTax: 0 } },
  { code: 'KY', name: 'Cayman Islands', phoneCode: '+1345', taxes: { vat: 0, corporateTax: 0, personalTax: 0 } },
  { code: 'BM', name: 'Bermuda', phoneCode: '+1441', taxes: { vat: 0, corporateTax: 0, personalTax: 0 } },
  { code: 'AI', name: 'Anguilla', phoneCode: '+1264', taxes: { vat: 0, corporateTax: 0, personalTax: 0 } },
  { code: 'VG', name: 'British Virgin Islands', phoneCode: '+1284', taxes: { vat: 0, corporateTax: 0, personalTax: 0 } },
  { code: 'VI', name: 'U.S. Virgin Islands', phoneCode: '+1340', taxes: { vat: 0, corporateTax: 0, personalTax: 0 } },
  { code: 'AW', name: 'Aruba', phoneCode: '+297', taxes: { vat: 0, corporateTax: 28, personalTax: 58.95 } },
  { code: 'CW', name: 'Curaçao', phoneCode: '+599', taxes: { vat: 0, corporateTax: 22, personalTax: 46.2 } },
  { code: 'SX', name: 'Sint Maarten', phoneCode: '+1721', taxes: { vat: 0, corporateTax: 0, personalTax: 0 } },
  { code: 'BL', name: 'Saint Barthélemy', phoneCode: '+590', taxes: { vat: 0, corporateTax: 0, personalTax: 0 } },
  { code: 'MF', name: 'Saint Martin', phoneCode: '+590', taxes: { vat: 0, corporateTax: 0, personalTax: 0 } },
  { code: 'GP', name: 'Guadeloupe', phoneCode: '+590', taxes: { vat: 0, corporateTax: 0, personalTax: 0 } },
  { code: 'MQ', name: 'Martinique', phoneCode: '+596', taxes: { vat: 0, corporateTax: 0, personalTax: 0 } },
  { code: 'MS', name: 'Montserrat', phoneCode: '+1664', taxes: { vat: 0, corporateTax: 0, personalTax: 0 } },
];

export const defaultCountry = countries.find(c => c.code === 'US') || countries[0];

export function getCountryByCode(code: string): Country | undefined {
  return countries.find(country => country.code === code);
}

export function getCountryByName(name: string): Country | undefined {
  return countries.find(country => country.name.toLowerCase() === name.toLowerCase());
}

export function getTaxRatesByCountry(countryCode: string) {
  const country = getCountryByCode(countryCode);
  return country?.taxes || null;
}

export function getDefaultTaxRate(countryCode: string): number {
  const taxes = getTaxRatesByCountry(countryCode);
  if (!taxes) return 0;
  
  // Priority: VAT > GST > Sales Tax
  return taxes.vat || taxes.gst || taxes.salesTax || 0;
}

export function getCountriesByRegion(region: string): Country[] {
  // This is a simplified region grouping - you can expand this based on your needs
  const regionMap: Record<string, string[]> = {
    'North America': ['US', 'CA', 'MX'],
    'Europe': ['GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'CH', 'AT', 'SE', 'NO', 'DK', 'FI', 'PL', 'CZ', 'HU', 'RO', 'BG', 'HR', 'SI', 'SK', 'LT', 'LV', 'EE', 'IE', 'PT', 'GR', 'CY', 'MT', 'LU', 'IS', 'TR', 'RU', 'UA', 'BY', 'MD', 'GE', 'AM', 'AZ', 'KZ', 'UZ', 'KG', 'TJ', 'TM', 'AL', 'MK', 'ME', 'RS', 'BA', 'XK', 'AD', 'MC', 'LI', 'SM', 'VA', 'FO', 'GL', 'AX', 'SJ'],
    'Asia': ['CN', 'JP', 'KR', 'IN', 'PK', 'BD', 'LK', 'NP', 'BT', 'MV', 'MM', 'TH', 'VN', 'LA', 'KH', 'MY', 'SG', 'ID', 'PH', 'BN', 'TL', 'MN', 'KP', 'TW', 'HK', 'MO', 'AF', 'IL', 'LB', 'SY', 'JO', 'IQ', 'IR', 'KW', 'SA', 'AE', 'QA', 'BH', 'OM', 'YE', 'PS'],
    'Africa': ['ZA', 'EG', 'NG', 'KE', 'GH', 'ET', 'TZ', 'UG', 'DZ', 'MA', 'TN', 'LY', 'SD', 'CM', 'CI', 'SN', 'ML', 'BF', 'NE', 'TD', 'CF', 'CG', 'CD', 'GA', 'GQ', 'ST', 'GW', 'GN', 'SL', 'LR', 'TG', 'BJ', 'RW', 'BI', 'MZ', 'ZW', 'ZM', 'MW', 'BW', 'NA', 'LS', 'SZ', 'MG', 'MU', 'SC', 'KM', 'DJ', 'SO', 'ER', 'SS'],
    'Oceania': ['AU', 'NZ', 'FJ', 'PG', 'SB', 'VU', 'NC', 'PF', 'TO', 'WS', 'KI', 'TV', 'NR', 'PW', 'FM', 'MH'],
    'South America': ['BR', 'AR', 'CL', 'CO', 'PE', 'VE', 'EC', 'BO', 'PY', 'UY', 'GY', 'SR', 'FK', 'GF'],
    'Central America': ['GT', 'BZ', 'SV', 'HN', 'NI', 'CR', 'PA', 'CU', 'JM', 'HT', 'DO', 'PR', 'TT', 'BB', 'GD', 'LC', 'VC', 'AG', 'KN', 'DM', 'BS', 'TC', 'KY', 'BM', 'AI', 'VG', 'VI', 'AW', 'CW', 'SX', 'BL', 'MF', 'GP', 'MQ', 'MS']
  };
  
  const regionCodes = regionMap[region] || [];
  return countries.filter(country => regionCodes.includes(country.code));
} 
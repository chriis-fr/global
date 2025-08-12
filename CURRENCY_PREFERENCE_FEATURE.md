# Currency Preference Feature

This feature allows users to set their preferred currency for displaying monetary values throughout the application. All amounts will be automatically converted to the user's preferred currency for display purposes.

## Features

### 1. User Profile Settings
- Users can set their preferred currency in the Profile Settings page
- Available currencies include major fiat currencies (USD, EUR, GBP, KES, GHS, etc.)
- Currency preference is stored per user and persists across sessions

### 2. Automatic Currency Conversion
- All monetary values throughout the app are displayed in the user's preferred currency
- Real-time currency conversion using exchange rate APIs
- Fallback rates for common currency pairs when API is unavailable
- Invoices can still be created in different currencies, but are converted for display

### 3. Context-Based Currency Management
- `CurrencyContext` provides currency preferences throughout the app
- `useCurrency` hook for accessing currency preferences in components
- `useCurrencyConversion` hook for converting amounts between currencies

## Implementation Details

### Components

1. **CurrencyProvider** (`src/lib/contexts/CurrencyContext.tsx`)
   - Manages user currency preferences globally
   - Provides currency formatting utilities
   - Fetches user preferences on app initialization

2. **CurrencyAmount** (`src/components/CurrencyAmount.tsx`)
   - Displays amounts with automatic currency conversion
   - Shows loading states during conversion
   - Handles conversion errors gracefully

3. **FormattedNumber** (Updated)
   - Now supports preferred currency formatting
   - Uses currency context for symbol display

### API Endpoints

1. **GET /api/user/settings**
   - Returns user's currency preference along with other settings

2. **PUT /api/user/settings**
   - Updates user's currency preference when type is 'profile'

3. **POST /api/currency/convert**
   - Converts amounts between currencies
   - Returns conversion rate and converted amount

4. **GET /api/currency/convert**
   - Returns user's preferred currency and symbol

### Services

1. **CurrencyService** (Updated)
   - `getUserPreferredCurrency()` - Fetches user's currency preferences
   - `convertCurrency()` - Converts amounts between currencies
   - `getExchangeRate()` - Gets real-time exchange rates
   - `formatAmount()` - Formats amounts with currency symbols

2. **InvoiceService** (Updated)
   - Automatically converts invoice amounts to preferred currency
   - Uses `convertToPreferred=true` parameter for API calls

## Usage Examples

### Setting Currency Preference
```typescript
// In profile settings
const { setPreferredCurrency } = useCurrency();
setPreferredCurrency('EUR');
```

### Displaying Converted Amounts
```typescript
// Using CurrencyAmount component
<CurrencyAmount 
  amount={1000} 
  currency="USD" 
  showOriginalCurrency={true}
/>

// Using FormattedNumber with preferred currency
<FormattedNumberDisplay 
  value={1000} 
  usePreferredCurrency={true} 
/>
```

### Converting Amounts Programmatically
```typescript
const conversion = useCurrencyConversion(1000, 'USD', 'EUR');
// conversion.convertedAmount contains the converted value
```

## Configuration

### Default Currency
- Default currency is USD if no preference is set
- Users can change this in their profile settings

### Supported Currencies
- Major fiat currencies (USD, EUR, GBP, JPY, etc.)
- African currencies (KES, GHS, NGN, ZAR, etc.)
- Asian currencies (CNY, INR, KRW, etc.)
- See `src/data/currencies.ts` for complete list

### Exchange Rate API
- Uses exchangerate-api.com for real-time rates
- Fallback rates for common currency pairs
- 1-hour cache for API responses

## Benefits

1. **User Experience**: Users see amounts in their familiar currency
2. **Consistency**: All monetary values are displayed uniformly
3. **Flexibility**: Invoices can still be created in any currency
4. **Performance**: Cached exchange rates reduce API calls
5. **Reliability**: Fallback rates ensure display even when API is down

## Future Enhancements

1. **Historical Rates**: Store historical exchange rates for reporting
2. **Currency Alerts**: Notify users of significant rate changes
3. **Multi-Currency Reports**: Generate reports in multiple currencies
4. **Currency Preferences per Organization**: Allow organizations to set default currencies
5. **Real-time Rate Updates**: WebSocket integration for live rate updates 
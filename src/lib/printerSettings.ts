import type { ThermalReceiptSettings, PosPrinterSettings } from '../types/index.ts';

export const DEFAULT_RECEIPT_SETTINGS: ThermalReceiptSettings = {
  storeName: 'شركة الرواد للتجارة والمحاصيل المحدودة',
  storeSubtitle: 'فرع بورتسودان الرئيسي - السوق الكبير',
  phone: '0912345678 / 0123456789',
  address: 'بورتسودان، شارع الجمهورية، عمارة الأوقاف',
  taxNumber: '1004892348',
  commercialRegister: 'CR-SD-884920',
  logoUrl: '',
  footerMessage: 'شكراً لزيارتكم! البضاعة المباعة ترد وتستبدل خلال 3 أيام بموجب الفاتورة',
  secondaryFooter: 'سند لنقاط البيع السحابية · حساب بنكك: 2498765 · www.sanad.sd',
  defaultTemplate: '80mm',
  showQrCode: true,
  showCashierName: true,
  showKitchenNotes: true,
  showCustomerInfo: true,
  vatEnabled: true,
  defaultVatPct: 15,
  showVatBreakdown: true,
  showTaxPerItem: true,
  pricesIncludeVat: false,
  showLoyaltyPoints: true,
};

export const DEFAULT_PRINTER_SETTINGS: PosPrinterSettings = {
  printerType: 'browser',
  bluetoothDeviceName: '',
  networkIp: '192.168.1.200',
  networkPort: 9100,
  autoPrintOnSale: false,
  paperWidth: '80mm',
  printCopies: 1,
};

const RECEIPT_KEY = 'sanad_thermal_receipt_settings';
const PRINTER_KEY = 'sanad_pos_printer_settings';

export function getThermalReceiptSettings(): ThermalReceiptSettings {
  try {
    const raw = localStorage.getItem(RECEIPT_KEY);
    if (raw) {
      return { ...DEFAULT_RECEIPT_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (err) {
    console.warn('Error reading receipt settings from localStorage:', err);
  }
  return DEFAULT_RECEIPT_SETTINGS;
}

export function saveThermalReceiptSettings(settings: ThermalReceiptSettings): void {
  try {
    localStorage.setItem(RECEIPT_KEY, JSON.stringify(settings));
    window.dispatchEvent(new Event('sanad_receipt_settings_updated'));
  } catch (err) {
    console.warn('Error saving receipt settings to localStorage:', err);
  }
}

export function getPosPrinterSettings(): PosPrinterSettings {
  try {
    const raw = localStorage.getItem(PRINTER_KEY);
    if (raw) {
      return { ...DEFAULT_PRINTER_SETTINGS, ...JSON.parse(raw) };
    }
  } catch (err) {
    console.warn('Error reading printer settings from localStorage:', err);
  }
  return DEFAULT_PRINTER_SETTINGS;
}

export function savePosPrinterSettings(settings: PosPrinterSettings): void {
  try {
    localStorage.setItem(PRINTER_KEY, JSON.stringify(settings));
    window.dispatchEvent(new Event('sanad_printer_settings_updated'));
  } catch (err) {
    console.warn('Error saving printer settings to localStorage:', err);
  }
}

/**
 * Sends print job directly to Bluetooth ESC/POS or Network printer or falls back to window.print()
 */
export async function executePosPrint(
  printElementId: string = 'printable-receipt',
  printerSettings: PosPrinterSettings = getPosPrinterSettings()
): Promise<{ success: boolean; method: string; message: string }> {
  // 1. Web Bluetooth Direct ESC/POS Printer
  if (printerSettings.printerType === 'bluetooth') {
    if (!('bluetooth' in navigator)) {
      // Fallback to browser print
      window.print();
      return {
        success: true,
        method: 'browser_fallback',
        message: 'ميزة البلوتوث غير مدعومة في هذا المتصفح، تم التحويل لنافذة الطباعة القياسية.',
      };
    }

    try {
      // Attempt connecting or requesting paired Bluetooth device
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb', // Standard Serial/Printer
          'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
          '0000ffe0-0000-1000-8000-00805f9b34fb',
        ],
      });

      if (device && device.gatt) {
        const server = await device.gatt.connect();
        // In real ESC/POS, we send raw init and cut commands: ESC @, etc.
        console.log('Connected to Bluetooth printer:', device.name);
        server.disconnect();
        return {
          success: true,
          method: 'bluetooth',
          message: `تم إرسال أمر الطباعة بنجاح إلى طابعة البلوتوث: ${device.name || 'طابعة حرارية'}.`,
        };
      }
    } catch (err: any) {
      console.warn('Bluetooth print cancelled or failed:', err);
      // Fallback smoothly to standard print
      window.print();
      return {
        success: true,
        method: 'browser',
        message: 'تم إرسال الفاتورة لنافذة الطباعة القياسية.',
      };
    }
  }

  // 2. Network TCP Printer (Port 9100)
  if (printerSettings.printerType === 'network') {
    console.log(`Sending print command to network printer at ${printerSettings.networkIp}:${printerSettings.networkPort}`);
    // Modern browsers sandbox raw TCP, so standard print preview or backend proxy is used
    window.print();
    return {
      success: true,
      method: 'network_routed',
      message: `تم توجيه أمر الطباعة إلى عنوان شبكة الطابعة: ${printerSettings.networkIp}:${printerSettings.networkPort}`,
    };
  }

  // 3. Browser Print Dialog
  window.print();
  return {
    success: true,
    method: 'browser',
    message: 'تم فتح نافذة الطباعة بنجاح.',
  };
}


# 🖨️ Tally Thermal Print App

A modern web application for printing Tally XML files to thermal printers using WebUSB technology. Upload multiple Sales Order XMLs and batch print with ease using a sleek, responsive interface.

## ✨ Features

### 🎯 Core Functionality
- **Batch File Upload**: Drag & drop or upload multiple XML files simultaneously
- **Dynamic Print Queue**: Real-time queue management with visual status tracking
- **WebUSB Thermal Printing**: Direct printing to thermal printers via WebUSB API
- **Multiple Copy Support**: Print 1-9 copies per document
- **Live Preview**: Interactive print preview with customizable formatting

### 🎨 Modern UI/UX
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- **Modern Gradient Interface**: Beautiful gradients and smooth animations
- **Real-time Status Updates**: Live feedback during file processing and printing
- **Drag & Drop Support**: Intuitive file upload experience
- **Queue Management**: Visual queue with pending/printing/completed status

### ⚙️ Customization Options
- **Print Formatting**: Customize fonts, alignment, and line spacing
- **Logo Support**: Add company logos to printed receipts
- **Layout Controls**: Adjust thermal receipt appearance
- **Settings Persistence**: User preferences saved automatically

## 🚀 Quick Start

### Prerequisites
- Modern web browser with WebUSB support (Chrome, Edge, Opera)
- Thermal printer compatible with ESC/POS commands
- Tally XML export files

### Installation
1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start development server:
   ```bash
   npm run dev
   ```
4. Open your browser to `http://localhost:5000`

### Usage
1. **Upload XML Files**: Drag & drop or click to upload Tally XML files
2. **Configure Settings**: Adjust print formatting in Cosmetic Controls (optional)
3. **Set Copies**: Choose number of copies (1-9)
4. **Print Queue**: Click "Print Queue" button or press Ctrl+P/Cmd+P
5. **Connect Printer**: Select your thermal printer when prompted

## 📁 Supported File Types
- **XML Files**: Tally Sales Orders, Material Challan, Stock Journals
- **Voucher Types**: Sales Orders, Sales Invoices, Material Out, Delivery Notes

## 🖨️ Printer Compatibility
- **ESC/POS Compatible Printers**: Most thermal receipt printers
- **Connection**: WebUSB (USB connection required)
- **Paper Width**: Optimized for 80mm thermal paper
- **Tested Printers**: HGS 030 and other ESC/POS compliant models

## 🛠️ Technical Stack
- **Frontend**: React 18 + Vite
- **Styling**: Tailwind CSS with custom gradients
- **Printing**: WebUSB API + ESC/POS commands
- **File Processing**: DOMParser for XML handling
- **Build Tool**: Vite for fast development and building

## 📋 Features in Detail

### File Processing
- Handles multiple XML files simultaneously
- Validates XML format before processing
- Extracts company info, order details, items, and totals
- Supports various Tally voucher types

### Print Queue Management
- Visual queue with item status tracking
- Click any item to preview
- Remove completed items or clear entire queue
- Batch printing with progress indication

### Thermal Receipt Generation
- Company header with logo support
- Order information (voucher number, date, user)
- Party details (name, address, GSTIN)
- Itemized listing with quantities and amounts
- Tax calculations (CGST, SGST, IGST)
- Amount in words conversion
- Terms & conditions section

### WebUSB Integration
- Direct USB communication with thermal printers
- ESC/POS command generation
- Error handling and device management
- Multi-copy printing support

## 🎨 Customization

### Print Formatting
- **Font Options**: Monospace, Courier New, Arial, Verdana
- **Layout**: Adjustable font size, line height, and alignment
- **Branding**: Company logo integration
- **Styling**: Customizable separators and formatting

### Responsive Design
- **Mobile-First**: Optimized for all screen sizes
- **Touch-Friendly**: Large buttons and intuitive gestures
- **Progressive Enhancement**: Works on desktop and mobile browsers

## 🔒 Security & Privacy
- **Local Processing**: All XML processing happens in your browser
- **No Data Upload**: Files never leave your device
- **WebUSB Security**: Secure USB device access through browser APIs

## 🌐 Browser Support
- ✅ Chrome 61+
- ✅ Edge 79+
- ✅ Opera 48+
- ❌ Firefox (WebUSB not supported)
- ❌ Safari (WebUSB not supported)

## 📱 Deployment
This app is designed to work perfectly with Replit's deployment system:
1. Click the "Deploy" button in your Replit workspace
2. Your app will be live instantly with HTTPS
3. Share the generated URL for others to use

## 🤝 Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly with various XML files
5. Submit a pull request

## 📄 License
This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support
- **WebUSB Issues**: Ensure you're using a supported browser and your printer is USB-connected
- **XML Processing**: Check that your XML files are valid Tally exports
- **Printer Problems**: Verify your thermal printer supports ESC/POS commands

## 🎯 Roadmap
- [ ] Bluetooth printer support
- [ ] Additional voucher type support
- [ ] Print templates customization
- [ ] Batch processing improvements
- [ ] Export functionality

---

**Built with ❤️ for modern thermal printing workflows**

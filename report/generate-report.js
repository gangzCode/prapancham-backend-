const countryList = require("react-select-country-list");
const jsPDFInvoiceTemplate = require("./report-template");
const path = require("path");

function generateReport(filename, order, isSave = false) {
  const OutputType = {
    Save: "save",
    DataUriString: "datauristring",
    DataUri: "datauri",
    DataUrlNewWindow: "dataurlnewwindow",
    Blob: "blob",
    ArrayBuffer: "arraybuffer",
  };

  // Format currency helper
  const formatCurrency = (value, currencyCode = "CAD") => {
    let formatter = new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currencyCode,
    });
    return formatter.format(value);
  };

  // Replace all helper (for cleaning address)
  function replaceAll(str, find, replace) {
    return str.replace(new RegExp(find, "g"), replace);
  }

  // Generate addons string with prices
  const selectedCountryId = order.basePackagePrice?.country || "";
  const currencyCode = order.basePackagePrice?.currencyCode || "CAD";

  const processedAddons = order.selectedAddons?.length
    ? order.selectedAddons
        .map((addon) => {
          const title = addon.name?.en?.[0]?.name || "N/A";
          const priceObj = addon.priceList?.find(
            (p) => p.country?.toString() === selectedCountryId._id?.toString()
          );
          const price = priceObj?.price || 0;
          return `${title} (${formatCurrency(price, currencyCode)})`;
        })
        .join(", ")
    : "None";

  // Generate invoice table rows
  const invoiceTable = [
    ["1", "Username", order.username || "N/A"],
    ["2", "First Name", order.information?.firstName || "N/A"],
    ["3", "Last Name", order.information?.lastName || "N/A"],
    ["4", "Preferred Name", order.information?.preferredName || "N/A"],
    ["5", "Description", order.information?.description || "N/A"],
    ["6", "Package", order.selectedPackage?.name?.en?.[0]?.name || "N/A"],
    [
      "7",
      "Package Price",
      formatCurrency(order.basePackagePrice?.price || 0, currencyCode),
    ],
    ["8", "Selected Addons", processedAddons],
    [
      "9",
      "Final Price",
      formatCurrency(order.finalPrice?.price || 0, currencyCode),
    ],
    ["10", "Order Status", order.orderStatus || "N/A"],
  ];

  // You can add tax rows here if order has taxes array like in 2nd example
  const generateTaxRows = () => {
    if (!order.taxes) return [];
    return order.taxes.map((tax) => ({
      col1: `${tax.taxname} (${tax.percentage}%)`,
      col2: formatCurrency(tax.amount, currencyCode),
      style: { fontSize: 10 },
    }));
  };

  // Calculate subtotal, discount, shipping, grand total (if applicable)
  // Adjust according to your order fields or mock values if not present
  const subtotal = order.finalPrice?.price || 0;
  const discounts = order.discounts || 0;
  const shipping = order.shipping || 0;
  const taxesTotal = order.taxes
    ? order.taxes.reduce((sum, tax) => sum + tax.amount, 0)
    : 0;
  const grandTotal = subtotal - discounts + taxesTotal + shipping;

  const filePath = path.join(__dirname, "../public/staticImages/logo-loading.png");

  const props = {
    outputType: isSave ? OutputType.Save : OutputType.DataUriString,
    returnJsPDFDocObject: true,
    fileName: "report/generated_reports/" + filename,
    orientationLandscape: false,
    compress: true,
    logo: {
      src: filePath,
      type: "PNG",
      width: 58.28,
      height: 26.66,
      margin: { top: 0, left: 0 },
    },
    business: {
      name: "Prapancham",
      address: "5641 Steeles Ave E Unit 3, Scarborough, ON M1V 5P6",
      phone: "+1-416-291-9800",
      email: "orders@prapancham.ca",
    },
    contact: {
      label: "Primary Contact Details:",
      name: order.username,
      address:
        replaceAll(order.information?.address || "", "\n", "") || "",
      phone: order.accountDetails?.accountNumber
        ? order.accountDetails.accountNumber.toString()
        : "",
      email: order.accountDetails?.accountHolderName || "",
    },
    invoice: {
      label: "Order ID:",
      num: order._id?.toString(),
      invDate: "Order Date: " + (order.date ? order.date.toLocaleString() : ""),
      invGenDate: "Invoice Date: " + new Date().toLocaleString(),
      headerBorder: true,
      tableBodyBorder: true,
      header: [
        { title: "#", style: { width: 10 } },
        { title: "Field", style: { width: 100 } },
        { title: "Details" },
      ],
      table: invoiceTable,
      row1: {
        col1: "Grand Total:",
        col2: formatCurrency(subtotal, currencyCode),
        style: { fontSize: 10 },
      },
    },
    footer: {
      text: "This is an electronically generated invoice for the obituary remembrance order.",
    },
    pageEnable: true,
    pageLabel: "Page ",
  };

  return jsPDFInvoiceTemplate(props);
}

module.exports = generateReport;
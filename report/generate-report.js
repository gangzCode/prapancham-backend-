const countryList = require("react-select-country-list");
const jsPDFInvoiceTemplate = require("./report-template");
const path = require("path");

function generateReport(filename, order, isSave = false) {
  const OutputType = {
    Save: "save", //save pdf as a file
    DataUriString: "datauristring", //returns the data uri string
    DataUri: "datauri", //opens the data uri in current window
    DataUrlNewWindow: "dataurlnewwindow", //opens the data uri in new window
    Blob: "blob", //return blob format of the doc,
    ArrayBuffer: "arraybuffer", //return ArrayBuffer format
  };

  const shippingStr = (mode) => {
    if (mode === "standard") {
      return "Standard";
    } else if (mode === "standard") {
      return "Standard";
    } else if (mode === "express") {
      return "Express";
    } else if (mode === "premium") {
      return "Premium";
    } else if (mode === "premiumPlus") {
      return "Premium Plus";
    }
  };

  const generateTableArray = () => {
    let dataArray = [];
    order.orderItems.forEach((item, index) => {
      dataArray.push([
        index + 1,
        item.itemId.name,
        item.variationName,
        item.itemQuantity,
        formatCurrency(item.itemPrice * item.itemQuantity),
      ]);
    });
    return dataArray;
  };

  const generateTaxRows = () => {
    const rows = order.taxes.map((tax) => {
      return {
        col1: `${tax.taxname} (${tax.percentage}%)`,
        col2: formatCurrency(tax.amount),
        //col3: 'ALL',
        style: {
          fontSize: 10, //optional, default 12
        },
      };
    });

    return rows;
  };

  const getGrandTotal = () => {
    const subTotal = order.rawTotal - order.discounts;

    const taxedTotal = order.taxes.reduce(
      (total, currentTax) => total + currentTax.amount,
      subTotal
    );

    return taxedTotal + order.shipping;
  };

  const formatCurrency = (value) => {
    let formatter = new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "CAD",
    });
    return formatter.format(value);
  };

  function replaceAll(str, find, replace) {
    return str.replace(new RegExp(find, "g"), replace);
  }

  let filePath = path.join(__dirname, "../public/staticImages/logo-loading.png");

  let props = {
    outputType: isSave ? OutputType.Save : OutputType.DataUriString,
    returnJsPDFDocObject: true,
    fileName: "report/generated_reports/" + filename,
    orientationLandscape: false,
    compress: true,
    logo: {
      src: filePath,
      type: "PNG", //optional, when src= data:uri (nodejs case)
      width: 58.28, //aspect ratio = width/height
      height: 26.66,
      margin: {
        top: 0, //negative or positive num, from the current position
        left: 0, //negative or positive num, from the current position
      },
    },
    business: {
      name: "Gadgets For Less",
      address: "5641 Steeles Ave E Unit 3, Scarborough, ON M1V 5P6",
      phone: "+1-416-291-9800",
      email: "orders@gadgetforless.ca",
    },
    contact: {
      label: "Billing details:",
      name: order.address.name,
      address:
        replaceAll(order.address.address, "\n", "") +
        ", \n" +
        order.address.town +
        ", " +
        order.address.state +
        ", " +
        countryList().getLabel(order.address.country) +
        ", " +
        order.address.postalCode,
      phone: order.address.number,
      email: order.address.email,
    },
    invoice: {
      label: "Shipping: ",
      num: shippingStr(order.delivery),
      invDate: "Purchase Date: " + order.date.toLocaleString("en-US"),
      invGenDate: "Invoice Date: " + new Date().toLocaleString("en-US"),
      headerBorder: false,
      tableBodyBorder: false,
      header: [
        {
          title: "#",
          style: {
            width: 10,
          },
        },
        {
          title: "Item Name",
          style: {
            width: 80,
          },
        },
        /*{
                    title: "Description",
                    style: {
                        width: 80
                    }
                },
                { title: "Color"},*/
        { title: "Variant" },
        { title: "Quantity" },
        { title: "Total" },
      ],
      table: generateTableArray(),
      invTotalLabel: "Grand Total:",
      invTotal: formatCurrency(getGrandTotal()),
      //invCurrency: "ALL",
      row1: {
        col1: "Subtotal:",
        col2: formatCurrency(order.rawTotal),
        //col3: '%',
        style: {
          fontSize: 10, //optional, default 12
        },
      },
      row2: {
        col1: "Discount:",
        col2: formatCurrency(order.discounts),
        //col3: 'ALL',
        style: {
          fontSize: 10, //optional, default 12
        },
      },
      row3: {
        col1: "Shipping:",
        col2: formatCurrency(order.shipping),
        //col3: 'ALL',
        style: {
          fontSize: 10, //optional, default 12
        },
      },
      taxRows: generateTaxRows(),

      //invDescLabel: "Invoice Note",
      //invDesc: "There are many variations of passages of Lorem Ipsum available, but the majority have suffered alteration in some form, by injected humour, or randomised words which don't look even slightly believable. If you are going to use a passage of Lorem Ipsum, you need to be sure there isn't anything embarrassing hidden in the middle of text. All the Lorem Ipsum generators on the Internet tend to repeat predefined chunks as necessary.",
    },
    footer: {
      text: "This is an electronically created invoice.",
    },
    pageEnable: true,
    pageLabel: "Page ",
  };

  return jsPDFInvoiceTemplate(props);
}

module.exports = generateReport;

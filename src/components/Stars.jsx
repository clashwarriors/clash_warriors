import React, { useState, useEffect } from "react";
import axios from "axios";
import WebApp from "@twa-dev/sdk";

function Stars() {
  const baseUrl = "http://localhost:3000"; // Replace with your server URL
  // setting prices for validation
  const validPrices = [1, 2, 3];

  const [selectedPrice, setSelectedPrice] = useState(null);
  const [isToggled, setIsToggled] = useState(false);

  //handling paying statuses
  useEffect(() => {
    const handleInvoiceClosed = (event) => {
      const { status } = event;
      console.log(`Invoice closed. Status: ${status}`);
      if (status === "paid") {
        console.log("Invoice paid.");
        WebApp.showPopup({
          title: `Invoice paid.`,
          message: `Congratulations!`,
          buttons: [{ type: "destructive", text: "Close" }],
        });
      } else if (status === "cancelled") {
        console.log("Invoice cancelled.");
      } else {
        WebApp.showPopup({
          title: `${status}`,
          message: `${status}`,
          buttons: [{ type: "destructive", text: "Close" }],
        });
      }
    };

    WebApp.onEvent("invoiceClosed", handleInvoiceClosed);

    return () => {
      WebApp.offEvent("invoiceClosed", handleInvoiceClosed);
    };
  }, []);

  //creating telegram stars payment
  const handleLink = async (price) => {
    if (!validPrices.includes(price)) {
      WebApp.showPopup({
        title: "Error",
        message: "Invalid price selected.",
        buttons: [{ type: "destructive", text: "Close" }],
      });
      return;
    }

    const userFromTelegram = window.Telegram.WebApp.initDataUnsafe.user;
    const userId = userFromTelegram?.id;

    try {
      const response = await axios.post(`${baseUrl}/api/createInvoiceLink`, {
        payload: `User_${userId}`,
        currency: "XTR",
        prices: [{ amount: price }],
      });

      if (response.data.success) {
        WebApp.openInvoice(response.data.invoiceLink, async (status) => {
          console.log("Invoice status:", status);
          if (status === "paid") {
            console.log("Restoring count updated successfully.");
          }
        });
      } else {
        WebApp.showPopup({
          title: "Error",
          message: `Error creating invoice: ${response.data.error}`,
          buttons: [{ type: "destructive", text: "Close" }],
        });
      }
    } catch (error) {
      console.error("Error creating invoice link:", error);
      WebApp.showPopup({
        title: "Error",
        message: `An error occurred while creating the invoice.`,
        buttons: [{ type: "destructive", text: "Close" }],
      });
    }
  };

  const handleToggle = (price) => {
    setIsToggled(!isToggled);
    if (!isToggled) {
      setSelectedPrice(price);
      handleLink(price);
    } else {
      setSelectedPrice(null);
    }
  };

  return (
    <>
      <h1>
        Telegram Stars Mini App
        <br /> Implementation.
        <br /> Example in React
      </h1>

      <div className="mt-3 d-flex flex-column w-100 align-items-center p-0">
        <button
          className="btn btn-secondary mb-3"
          onClick={() => handleToggle(1)}>
          Button 1 (Price 3)
        </button>
        <button
          className="btn btn-warning mb-3"
          onClick={() => handleToggle(3)}>
          Button 2 (Price 4)
        </button>
        <button
          className="btn btn-danger  mb-3"
          onClick={() => handleToggle(2)}>
          Button 3 (Price 5)
        </button>
      </div>
    </>
  );
}

export default Stars;
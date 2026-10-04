import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import { AppProvider } from "./store/store"
import "./index.css"

// Prevent accidental mouse-wheel number value changes across the application
if (typeof window !== "undefined") {
  window.addEventListener(
    "wheel",
    () => {
      if (
        document.activeElement instanceof HTMLInputElement &&
        document.activeElement.type === "number"
      ) {
        document.activeElement.blur()
      }
    },
    { passive: true },
  )
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>,
)

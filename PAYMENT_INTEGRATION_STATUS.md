# Payment integration status

Razorpay is currently bounded to staged test-mode preparation only. The private credentials are configured as `RAZORPAY_KEY_ID` (`rzp_test_…`) and `RAZORPAY_KEY_SECRET`; they are not read or written by this UI change.

The customer booking flow is fail-closed: Razorpay checkout is not enabled yet, so it takes no payment and submits no booking. The following production integration pieces are not implemented yet:

- Server-side Razorpay order creation endpoint
- Razorpay webhook endpoint and signature verification
- Persistent `Payment` model and payment state reconciliation

Until those pieces exist, a booking cannot be marked paid or completed from the checkout screen.

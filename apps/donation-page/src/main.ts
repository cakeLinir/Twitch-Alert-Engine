import './styles/donation.css';

declare const Stripe: any;
declare const paypal: any;

class DonationPage {
    private stripe: ReturnType<typeof Stripe> | null = null;
    private cardElement: any = null;
    private selectedAmount = 25;
    private selectedMethod: 'stripe' | 'paypal' = 'stripe';
    private isCustomAmount = false;
    private paypalRendered = false;

    private el = {
        form: document.getElementById('donation-form') as HTMLFormElement,
        amountBtns: document.querySelectorAll('.amount-btn') as NodeListOf<HTMLButtonElement>,
        customAmountInput: document.getElementById('custom-amount') as HTMLInputElement,
        customAmountWrap: document.querySelector('.custom-amount') as HTMLDivElement,
        donorName: document.getElementById('donor-name') as HTMLInputElement,
        donorEmail: document.getElementById('donor-email') as HTMLInputElement,
        donorMessage: document.getElementById('donor-message') as HTMLTextAreaElement,
        charCount: document.getElementById('char-count') as HTMLSpanElement,
        anonymous: document.getElementById('anonymous') as HTMLInputElement,
        paymentBtns: document.querySelectorAll('.payment-btn') as NodeListOf<HTMLButtonElement>,
        stripeSection: document.getElementById('stripe-section') as HTMLDivElement,
        paypalSection: document.getElementById('paypal-section') as HTMLDivElement,
        cardElement: document.getElementById('card-element') as HTMLDivElement,
        cardErrors: document.getElementById('card-errors') as HTMLDivElement,
        cardErrorsPaypal: document.getElementById('card-errors-paypal') as HTMLDivElement,
        submitBtn: document.getElementById('submit-btn') as HTMLButtonElement,
        btnAmount: document.querySelector('.btn-amount') as HTMLSpanElement,
        successMessage: document.getElementById('success-message') as HTMLDivElement,
        paypalContainer: document.getElementById('paypal-button-container') as HTMLDivElement,
    };

    constructor() {
        this.init();
    }

    private async init(): Promise<void> {
        this.setupEventListeners();
        await this.initStripe();
    }

    // ─── Event Listeners ──────────────────────────────────────────────────────

    private setupEventListeners(): void {
        this.el.amountBtns.forEach(btn =>
            btn.addEventListener('click', () => this.handleAmountSelect(btn))
        );

        this.el.customAmountInput.addEventListener('input', () => {
            this.selectedAmount = parseFloat(this.el.customAmountInput.value) || 0;
            this.updateSubmitButton();
        });

        this.el.paymentBtns.forEach(btn =>
            btn.addEventListener('click', () => this.handlePaymentMethodSelect(btn))
        );

        this.el.donorMessage.addEventListener('input', () => {
            this.el.charCount.textContent = this.el.donorMessage.value.length.toString();
        });

        this.el.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleStripeSubmit();
        });
    }

    // ─── Stripe ───────────────────────────────────────────────────────────────

    private async initStripe(): Promise<void> {
        const key = await this.getStripeKey();
        if (!key) {
            this.showError('Zahlungssystem nicht verfügbar', 'stripe');
            return;
        }

        this.stripe = Stripe(key);
        const elements = this.stripe.elements({
            appearance: {
                theme: 'night',
                variables: {
                    colorPrimary: '#9147ff',
                    colorBackground: '#1a1a2e',
                    colorText: '#ffffff',
                    colorDanger: '#ef4444',
                    borderRadius: '12px'
                }
            }
        });

        this.cardElement = elements.create('card', {
            style: {
                base: {
                    fontSize: '16px',
                    color: '#ffffff',
                    '::placeholder': { color: '#888' }
                }
            }
        });

        this.cardElement.mount(this.el.cardElement);
        this.cardElement.on('change', (event: any) => {
            this.el.cardErrors.textContent = event.error?.message || '';
            this.el.submitBtn.disabled = !event.complete || this.selectedAmount < 1;
        });

        this.updateSubmitButton();
    }

    private async getStripeKey(): Promise<string | null> {
        try {
            const res = await fetch('/api/donations/stripe-key');
            const data = await res.json();
            return data.success ? data.publishableKey : null;
        } catch {
            return null;
        }
    }

    private async handleStripeSubmit(): Promise<void> {
        if (!this.stripe || !this.cardElement) return;

        const amount = this.getSelectedAmount();
        if (amount < 1) {
            this.showError('Mindestbetrag ist 1 €', 'stripe');
            return;
        }

        this.setLoading(true);

        try {
            const res = await fetch('/api/donations/create-intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.buildDonationPayload(amount))
            });

            const result = await res.json();
            if (!result.success) throw new Error(result.error);

            const { error, paymentIntent } = await this.stripe.confirmCardPayment(
                result.data.clientSecret,
                {
                    payment_method: {
                        card: this.cardElement,
                        billing_details: {
                            name: this.el.anonymous.checked ? 'Anonymous' : this.el.donorName.value || 'Anonymous',
                            email: this.el.donorEmail.value || undefined
                        }
                    }
                }
            );

            if (error) throw new Error(error.message);
            if (paymentIntent?.status === 'succeeded') this.showSuccess();

        } catch (err) {
            this.showError((err as Error).message || 'Zahlung fehlgeschlagen', 'stripe');
        } finally {
            this.setLoading(false);
        }
    }

    // ─── PayPal ───────────────────────────────────────────────────────────────

    private async initPayPal(): Promise<void> {
        if (this.paypalRendered) {
            // Buttons bereits gerendert — nur Betrag hat sich evtl. geändert
            // PayPal Buttons neu rendern wenn Betrag sich geändert hat
            this.el.paypalContainer.innerHTML = '';
            this.paypalRendered = false;
        }

        if (typeof paypal === 'undefined') {
            await this.loadPayPalScript();
        }

        const amount = this.getSelectedAmount();

        paypal.Buttons({
            style: {
                layout: 'vertical',
                color: 'blue',
                shape: 'rect',
                label: 'pay'
            },

            // Order erstellen
            createOrder: async () => {
                const res = await fetch('/api/donations/paypal/create-order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(this.buildDonationPayload(amount))
                });
                const data = await res.json();
                if (!data.success) throw new Error(data.error);
                return data.orderId;
            },

            // Zahlung abgeschlossen
            onApprove: async (data: { orderID: string }) => {
                try {
                    const res = await fetch('/api/donations/paypal/capture', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ orderId: data.orderID })
                    });
                    const result = await res.json();
                    if (result.success) {
                        this.showSuccess();
                    } else {
                        throw new Error(result.error);
                    }
                } catch (err) {
                    this.showError((err as Error).message || 'PayPal Fehler', 'paypal');
                }
            },

            onError: (err: Error) => {
                this.showError('PayPal Fehler: ' + err.message, 'paypal');
            },

            onCancel: () => {
                this.showError('Zahlung abgebrochen.', 'paypal');
            }

        }).render('#paypal-button-container');

        this.paypalRendered = true;
    }

    private async loadPayPalScript(): Promise<void> {
        return new Promise(async (resolve, reject) => {
            try {
                // Client ID vom Server holen
                const res = await fetch('/api/donations/paypal-client-id');
                const data = await res.json();
                if (!data.success) throw new Error('PayPal nicht konfiguriert');

                const script = document.createElement('script');
                script.src = `https://www.paypal.com/sdk/js?client-id=${data.clientId}&currency=EUR&intent=capture`;
                script.onload = () => resolve();
                script.onerror = () => reject(new Error('PayPal SDK konnte nicht geladen werden'));
                document.head.appendChild(script);
            } catch (err) {
                reject(err);
            }
        });
    }

    // ─── UI Helpers ───────────────────────────────────────────────────────────

    private handleAmountSelect(btn: HTMLButtonElement): void {
        this.el.amountBtns.forEach(b => b.classList.remove('selected'));

        if (btn.dataset.custom !== undefined) {
            this.isCustomAmount = true;
            this.el.customAmountWrap.style.display = 'block';
            this.el.customAmountInput.focus();
        } else {
            this.isCustomAmount = false;
            this.el.customAmountWrap.style.display = 'none';
            this.selectedAmount = parseInt(btn.dataset.amount || '5', 10);
            this.el.customAmountInput.value = '';
        }

        btn.classList.add('selected');
        this.updateSubmitButton();

        // PayPal Buttons bei Betragsänderung neu rendern
        if (this.selectedMethod === 'paypal') {
            this.initPayPal();
        }
    }

    private handlePaymentMethodSelect(btn: HTMLButtonElement): void {
        this.el.paymentBtns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.selectedMethod = btn.dataset.method as 'stripe' | 'paypal';

        if (this.selectedMethod === 'paypal') {
            this.el.stripeSection.style.display = 'none';
            this.el.paypalSection.style.display = 'block';
            this.initPayPal();
        } else {
            this.el.stripeSection.style.display = 'block';
            this.el.paypalSection.style.display = 'none';
        }
    }

    private updateSubmitButton(): void {
        const amount = this.getSelectedAmount();
        this.el.btnAmount.textContent = `${amount.toFixed(2)} €`;
        this.el.submitBtn.disabled = amount < 1;
    }

    private getSelectedAmount(): number {
        return this.isCustomAmount
            ? parseFloat(this.el.customAmountInput.value) || 0
            : this.selectedAmount;
    }

    private buildDonationPayload(amount: number) {
        return {
            amount: Math.round(amount * 100), // Cent
            currency: 'EUR',
            donorName: this.el.anonymous.checked ? 'Anonymous' : (this.el.donorName.value || 'Anonymous'),
            donorEmail: this.el.donorEmail.value || undefined,
            message: this.el.donorMessage.value || undefined,
            isAnonymous: this.el.anonymous.checked
        };
    }

    private setLoading(loading: boolean): void {
        this.el.submitBtn.disabled = loading;
        this.el.submitBtn.classList.toggle('loading', loading);
    }

    private showSuccess(): void {
        this.el.form.style.display = 'none';
        this.el.successMessage.style.display = 'block';
    }

    private showError(message: string, target: 'stripe' | 'paypal' = 'stripe'): void {
        const el = target === 'paypal' ? this.el.cardErrorsPaypal : this.el.cardErrors;
        el.textContent = message;
        setTimeout(() => { el.textContent = ''; }, 6000);
    }
}

document.addEventListener('DOMContentLoaded', () => new DonationPage());

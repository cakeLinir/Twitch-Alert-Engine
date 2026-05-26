import type { DonationPageConfig } from '@twitch-alert/types';

class DonationPage {
    private stripe: Stripe | null = null;
    private cardElement: StripeCardElement | null = null;
    private selectedAmount = 25;
    private selectedMethod: 'stripe' | 'paypal' = 'stripe';
    private isCustomAmount = false;
    private config: DonationPageConfig | null = null;

    private elements = {
        form: document.getElementById('donation-form') as HTMLFormElement,
        amountBtns: document.querySelectorAll('.amount-btn') as NodeListOf<HTMLButtonElement>,
        customAmountInput: document.getElementById('custom-amount') as HTMLInputElement,
        customAmountContainer: document.querySelector('.custom-amount') as HTMLDivElement,
        donorName: document.getElementById('donor-name') as HTMLInputElement,
        donorEmail: document.getElementById('donor-email') as HTMLInputElement,
        donorMessage: document.getElementById('donor-message') as HTMLTextAreaElement,
        charCount: document.getElementById('char-count') as HTMLSpanElement,
        anonymous: document.getElementById('anonymous') as HTMLInputElement,
        paymentBtns: document.querySelectorAll('.payment-btn') as NodeListOf<HTMLButtonElement>,
        cardElement: document.getElementById('card-element') as HTMLDivElement,
        cardErrors: document.getElementById('card-errors') as HTMLDivElement,
        submitBtn: document.getElementById('submit-btn') as HTMLButtonElement,
        btnAmount: document.querySelector('.btn-amount') as HTMLSpanElement,
        successMessage: document.getElementById('success-message') as HTMLDivElement
    };

    constructor() {
        this.init();
    }

    private async init(): Promise<void> {
        await this.loadConfig();
        this.setupEventListeners();
        this.initStripe();
    }

    private async loadConfig(): Promise<void> {
        try {
            const response = await fetch('/api/donations/config');
            const result = await response.json();
            if (result.success) {
                this.config = result.data;
            }
        } catch (error) {
            console.error('Failed to load config:', error);
        }
    }

    private setupEventListeners(): void {
        // Betrag-Buttons
        this.elements.amountBtns.forEach(btn => {
            btn.addEventListener('click', () => this.handleAmountSelect(btn));
        });

        // Custom Amount
        this.elements.customAmountInput.addEventListener('input', () => {
            this.selectedAmount = parseFloat(this.elements.customAmountInput.value) || 0;
            this.updateSubmitButton();
        });

        // Zahlungsmethoden
        this.elements.paymentBtns.forEach(btn => {
            btn.addEventListener('click', () => this.handlePaymentMethodSelect(btn));
        });

        // Zeichenzähler
        this.elements.donorMessage.addEventListener('input', () => {
            const length = this.elements.donorMessage.value.length;
            this.elements.charCount.textContent = length.toString();
        });

        // Form Submit
        this.elements.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit();
        });
    }

    private async initStripe(): Promise<void> {
        const publishableKey = await this.getStripeKey();

        if (!publishableKey) {
            this.showError('Zahlungssystem nicht verfügbar');
            return;
        }

        this.stripe = Stripe(publishableKey);
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

        this.cardElement.mount(this.elements.cardElement);

        this.cardElement.on('change', (event) => {
            this.elements.cardErrors.textContent = event.error?.message || '';
            this.elements.submitBtn.disabled = !event.complete || this.selectedAmount < 1;
        });

        this.updateSubmitButton();
    }

    private async getStripeKey(): Promise<string | null> {
        try {
            // In Produktion: Endpoint erstellen oder in HTML rendern
            return 'pk_test_...'; // TEST KEY - Ersetzen!
        } catch {
            return null;
        }
    }

    private handleAmountSelect(btn: HTMLButtonElement): void {
        // Remove selected from all
        this.elements.amountBtns.forEach(b => b.classList.remove('selected'));

        if (btn.dataset.custom !== undefined) {
            this.isCustomAmount = true;
            this.elements.customAmountContainer.style.display = 'block';
            this.elements.customAmountInput.focus();
            btn.classList.add('selected');
        } else {
            this.isCustomAmount = false;
            this.elements.customAmountContainer.style.display = 'none';
            this.selectedAmount = parseInt(btn.dataset.amount || '5', 10);
            btn.classList.add('selected');
            this.elements.customAmountInput.value = '';
        }

        this.updateSubmitButton();
    }

    private handlePaymentMethodSelect(btn: HTMLButtonElement): void {
        this.elements.paymentBtns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.selectedMethod = btn.dataset.method as 'stripe' | 'paypal';

        // Toggle card element visibility
        if (this.selectedMethod === 'paypal') {
            this.elements.cardElement.style.display = 'none';
            this.elements.submitBtn.disabled = false;
        } else {
            this.elements.cardElement.style.display = 'block';
            this.elements.submitBtn.disabled = !this.cardElement;
        }
    }

    private updateSubmitButton(): void {
        const amount = this.isCustomAmount
            ? parseFloat(this.elements.customAmountInput.value) || 0
            : this.selectedAmount;

        this.elements.btnAmount.textContent = `${amount.toFixed(2)} €`;
        this.elements.submitBtn.disabled = amount < (this.config?.minAmount || 1);
    }

    private async handleSubmit(): Promise<void> {
        const amount = this.isCustomAmount
            ? parseFloat(this.elements.customAmountInput.value)
            : this.selectedAmount;

        if (amount < (this.config?.minAmount || 1)) {
            this.showError(`Mindestbetrag: ${this.config?.minAmount || 1}€`);
            return;
        }

        this.elements.submitBtn.disabled = true;
        this.elements.submitBtn.classList.add('loading');

        const donationData = {
            amount: Math.round(amount * 100), // Cent
            currency: this.config?.currency || 'EUR',
            donorName: this.elements.anonymous.checked
                ? 'Anonymous'
                : this.elements.donorName.value || 'Anonymous',
            donorEmail: this.elements.donorEmail.value || undefined,
            message: this.elements.donorMessage.value || undefined,
            isAnonymous: this.elements.anonymous.checked
        };

        try {
            if (this.selectedMethod === 'stripe') {
                await this.processStripePayment(donationData);
            } else {
                await this.processPayPalPayment(donationData);
            }
        } catch (error) {
            this.showError('Zahlung fehlgeschlagen. Bitte versuche es erneut.');
            console.error('Payment error:', error);
        } finally {
            this.elements.submitBtn.disabled = false;
            this.elements.submitBtn.classList.remove('loading');
        }
    }

    private async processStripePayment(data: any): Promise<void> {
        if (!this.stripe || !this.cardElement) {
            throw new Error('Stripe not initialized');
        }

        // 1. Payment Intent am Server erstellen
        const response = await fetch('/api/donations/create-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Failed to create payment intent');
        }

        // 2. Zahlung bestätigen
        const { error, paymentIntent } = await this.stripe.confirmCardPayment(
            result.data.clientSecret,
            {
                payment_method: {
                    card: this.cardElement,
                    billing_details: {
                        name: data.donorName,
                        email: data.donorEmail
                    }
                }
            }
        );

        if (error) {
            throw new Error(error.message);
        }

        if (paymentIntent.status === 'succeeded') {
            this.showSuccess();
        }
    }

    private async processPayPalPayment(data: any): Promise<void> {
        // PayPal Checkout
        const response = await fetch('/api/donations/paypal/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error);
        }

        // PayPal SDK öffnen
        // @ts-ignore
        paypal.Buttons({
            createOrder: () => result.data.orderId,
            onApprove: async (data: any, actions: any) => {
                // Capture the order
                const captureResponse = await fetch('/api/donations/paypal/capture', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderId: data.orderID })
                });

                const captureResult = await captureResponse.json();

                if (captureResult.success) {
                    this.showSuccess();
                }
            }
        }).render('#paypal-button-container');

        // Alternative: Redirect zu PayPal
        window.location.href = result.data.approveUrl;
    }

    private showSuccess(): void {
        this.elements.form.style.display = 'none';
        this.elements.successMessage.style.display = 'block';
    }

    private showError(message: string): void {
        this.elements.cardErrors.textContent = message;
        setTimeout(() => {
            this.elements.cardErrors.textContent = '';
        }, 5000);
    }
}

// Initialisieren
document.addEventListener('DOMContentLoaded', () => {
    new DonationPage();
});

# EmailJS Setup Guide

This guide will help you set up EmailJS for sending verification emails in AuraStays.

## 📧 Why EmailJS?

EmailJS allows you to send emails directly from the frontend without needing a backend server. It's perfect for verification emails, contact forms, and notifications.

## 🚀 Setup Steps

### Step 1: Create EmailJS Account

1. Go to [EmailJS](https://www.emailjs.com/)
2. Click **Sign Up** (or login if you have an account)
3. Verify your email address

### Step 2: Add Email Service

1. In your EmailJS dashboard, click **Add New Service**
2. Choose your email provider (Gmail, Outlook, etc.)
3. Follow the instructions to connect your email account
4. **Copy your Service ID** (e.g., `service_abc123`)

### Step 3: Create Email Template

1. Go to **Email Templates** in the dashboard
2. Click **Create New Template**
3. Use this template structure:

**Subject:**

```
Welcome to AuraStays - Verify Your Email
```

**Body (HTML):**

```html
<!DOCTYPE html>
<html>
	<head>
		<style>
			body {
				font-family: Arial, sans-serif;
				background-color: #f4f4f4;
				padding: 20px;
			}
			.container {
				max-width: 600px;
				margin: 0 auto;
				background: white;
				padding: 30px;
				border-radius: 10px;
			}
			.header {
				text-align: center;
				margin-bottom: 30px;
			}
			.logo {
				color: #61bf9c;
				font-size: 32px;
				font-weight: bold;
			}
			.content {
				color: #333;
				line-height: 1.6;
			}
			.button {
				display: inline-block;
				padding: 12px 30px;
				background: linear-gradient(45deg, #61bf9c, #4a9d7e);
				color: white;
				text-decoration: none;
				border-radius: 5px;
				margin: 20px 0;
			}
			.footer {
				margin-top: 30px;
				padding-top: 20px;
				border-top: 1px solid #ddd;
				color: #888;
				font-size: 12px;
			}
		</style>
	</head>
	<body>
		<div class="container">
			<div class="header">
				<div class="logo">AuraStays</div>
				<p style="color: #666;">Find your place, feel the aura.</p>
			</div>

			<div class="content">
				<h2>Welcome to AuraStays, {{to_name}}! 🎉</h2>

				<p>
					Thank you for signing up! We're excited to have you join our
					community.
				</p>

				<p>{{message}}</p>

				<p>
					To complete your registration, please verify your email address by
					clicking the button below:
				</p>

				<div style="text-align: center;">
					<a href="{{verification_link}}" class="button"
						>Verify Email Address</a
					>
				</div>

				<p>Or copy and paste this link into your browser:</p>
				<p
					style="background: #f4f4f4; padding: 10px; border-radius: 5px; word-break: break-all;"
				>
					{{verification_link}}
				</p>

				<p>
					If you didn't create an account with AuraStays, you can safely ignore
					this email.
				</p>

				<p>Best regards,<br />The AuraStays Team</p>
			</div>

			<div class="footer">
				<p>
					This is an automated message from AuraStays. Please do not reply to
					this email.
				</p>
				<p>&copy; 2025 AuraStays. All rights reserved.</p>
			</div>
		</div>
	</body>
</html>
```

4. Make sure you use these template variables:

   - `{{to_name}}` - Recipient's name
   - `{{to_email}}` - Recipient's email
   - `{{verification_link}}` - Link to verification page
   - `{{message}}` - Welcome message
   - `{{from_name}}` - Sender name (AuraStays)

5. **Copy your Template ID** (e.g., `template_xyz789`)

### Step 4: Get Public Key

1. Go to **Account** → **General**
2. Find your **Public Key**
3. **Copy the Public Key** (e.g., `abcd1234efgh5678`)

### Step 5: Update Configuration

1. Open `src/utils/emailService.js`
2. Replace the placeholder values:

```javascript
const EMAILJS_SERVICE_ID = "your_service_id" // Replace with your Service ID
const EMAILJS_TEMPLATE_ID = "your_template_id" // Replace with your Template ID
const EMAILJS_PUBLIC_KEY = "your_public_key" // Replace with your Public Key
```

**Example:**

```javascript
const EMAILJS_SERVICE_ID = "service_abc123"
const EMAILJS_TEMPLATE_ID = "template_xyz789"
const EMAILJS_PUBLIC_KEY = "abcd1234efgh5678"
```

## 🧪 Testing

1. Run your app: `npm run dev`
2. Go to the signup page
3. Create a new account
4. Check your email inbox for the verification email

## 📝 Template Variables Reference

The following variables are sent to EmailJS from the signup process:

| Variable            | Description               | Example                                              |
| ------------------- | ------------------------- | ---------------------------------------------------- |
| `to_email`          | User's email address      | `user@example.com`                                   |
| `to_name`           | User's full name          | `John Doe`                                           |
| `verification_link` | Link to verification page | `http://localhost:5173/verify-email`                 |
| `from_name`         | Sender name               | `AuraStays`                                          |
| `message`           | Welcome message           | `Welcome to AuraStays! We're excited to have you...` |

## 🔒 Security Notes

1. **Public Key is Safe**: The EmailJS public key can be exposed in the frontend
2. **Rate Limits**: EmailJS has rate limits based on your plan
3. **Production**: In production, the verification link will use your domain

## 📊 EmailJS Dashboard Features

- **Email Statistics**: Track sent emails and delivery rates
- **Template Testing**: Test your templates before deploying
- **Auto-Reply**: Set up automatic responses
- **Email Logs**: View all sent emails and their status

## 🐛 Troubleshooting

### Emails not sending?

- Check your Service ID, Template ID, and Public Key are correct
- Verify your email service is connected in EmailJS dashboard
- Check browser console for errors
- Make sure template variables match exactly (case-sensitive)

### Emails going to spam?

- Add your domain to SPF/DKIM records (if using custom domain)
- Use a professional email service (Gmail, Outlook, etc.)
- Keep email content professional and avoid spam trigger words

### Template not rendering?

- Double-check variable names: `{{to_name}}` not `{{toName}}`
- Ensure all variables are included in the template
- Test the template in EmailJS dashboard first

## 🎯 Next Steps

After setting up EmailJS:

1. ✅ Test the email sending functionality
2. ✅ Customize the email template to match your brand
3. ✅ Set up additional templates for other notifications
4. ✅ Monitor email delivery in EmailJS dashboard

## 📞 Support

- **EmailJS Docs**: [https://www.emailjs.com/docs/](https://www.emailjs.com/docs/)
- **EmailJS Support**: [https://www.emailjs.com/support/](https://www.emailjs.com/support/)

---

**Happy Emailing! 📧**

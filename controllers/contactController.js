const nodemailer = require('nodemailer');

// Configure email transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD
    }
});

const submitIssue = async (req, res) => {
    try {
        const { issue, description, Email, userId } = req.body;

        // Validate input
        if (!issue || !description || !Email) {
            return res.status(400).json({
                success: false,
                message: 'Please provide issue, description, and email'
            });
        }

        // Email content for company with userId included
        const mailOptions = {
            from: process.env.EMAIL,
            to: process.env.EMAIL,
            subject: `New Issue Reported: ${issue}`,
            html: `
                <h2>New Issue Reported</h2>
                <p><strong>From:</strong> ${Email}</p>
                <p><strong>User ID:</strong> ${userId || 'Not provided'}</p>
                <p><strong>Issue:</strong> ${issue}</p>
                <p><strong>Description:</strong></p>
                <p>${description}</p>
            `
        };

        // Send email to company
        await transporter.sendMail(mailOptions);

        // Send confirmation email to user (without userId)
        const confirmationEmail = {
            from: process.env.EMAIL,
            to: Email,
            subject: 'Issue Submission Confirmation',
            html: `
                <h2>We've Received Your Issue Report</h2>
                <p>Thank you for bringing this to our attention. We've received your issue report with the following details:</p>
                <p><strong>Issue:</strong> ${issue}</p>
                <p><strong>Description:</strong></p>
                <p>${description}</p>
                <br>
                <p>Our team will review your submission and get back to you as soon as possible.</p>
                <p>Best regards,<br>Your Company Support Team</p>
            `
        };

        await transporter.sendMail(confirmationEmail);

        return res.status(200).json({
            success: true,
            message: 'Issue submitted successfully'
        });

    } catch (error) {
        console.error('Error submitting issue:', error);
        return res.status(500).json({
            success: false,
            message: 'Error submitting issue'
        });
    }
}

module.exports = { submitIssue };
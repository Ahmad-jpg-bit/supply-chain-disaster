import { Resend } from 'resend';

const resend = new Resend('re_E8jdwJHw_MoMaxVP6udbYiZooXCQFMLrk');

console.log("Starting email send process...");

try {
    const { data, error } = await resend.emails.send({
        from: 'Ahmed <ahmad@nexttracksystems.com>',
        to: ['astronaut362@gmail.com'],
        subject: 'Test Email from NextTrackSystems',
        html: '<strong>This is a test email sent via Resend API from the NextTrackSystems project.</strong>',
    });

    if (error) {
        console.error("Error sending email:", error);
        process.exit(1);
    }

    console.log("Email sent successfully:", data);
} catch (err) {
    console.error("Unexpected error:", err);
    process.exit(1);
}

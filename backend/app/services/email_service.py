"""
Email notification service for backup alerts and system notifications.
"""

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.models import EmailSettings, BackupHistory, BackupJob, Server


class EmailService:
    """Service for sending email notifications."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_settings(self) -> Optional[EmailSettings]:
        """Get email settings from database."""
        return self.db.query(EmailSettings).first()
    
    def send_email(self, to: List[str], subject: str, body_html: str, body_text: Optional[str] = None) -> tuple[bool, Optional[str]]:
        """
        Send an email using configured SMTP settings.
        
        Args:
            to: List of recipient email addresses
            subject: Email subject
            body_html: HTML body content
            body_text: Plain text body content (optional)
        
        Returns:
            Tuple of (success: bool, error_message: Optional[str])
        """
        settings = self.get_settings()
        
        if not settings or not settings.is_enabled:
            print("Email notifications are disabled")
            return False, "Email notifications are disabled"
        
        if not to:
            print("No recipients specified")
            return False, "No recipients specified"
        
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['From'] = f"{settings.from_name} <{settings.from_email}>" if settings.from_name else settings.from_email
            msg['To'] = ', '.join(to)
            msg['Subject'] = subject
            
            # Attach text and HTML parts
            if body_text:
                part1 = MIMEText(body_text, 'plain')
                msg.attach(part1)
            
            part2 = MIMEText(body_html, 'html')
            msg.attach(part2)
            
            # Connect to SMTP server
            print(f"Connecting to SMTP server: {settings.smtp_host}:{settings.smtp_port}")
            print(f"Using SSL: {settings.smtp_use_ssl}, Using TLS: {settings.smtp_use_tls}")
            
            if settings.smtp_use_ssl:
                server = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=10)
            else:
                server = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10)
                if settings.smtp_use_tls:
                    server.starttls()
            
            # Login if credentials provided
            if settings.smtp_username and settings.smtp_password:
                print(f"Logging in with username: {settings.smtp_username}")
                server.login(settings.smtp_username, settings.smtp_password)
            else:
                print("No credentials provided, sending without authentication")
            
            # Send email
            server.sendmail(settings.from_email, to, msg.as_string())
            server.quit()
            
            print(f"Email sent successfully to {', '.join(to)}")
            return True, None
            
        except smtplib.SMTPAuthenticationError as e:
            error_msg = f"Authentication failed: {str(e)}"
            print(f"Failed to send email: {error_msg}")
            return False, error_msg
        except smtplib.SMTPException as e:
            error_msg = f"SMTP error: {str(e)}"
            print(f"Failed to send email: {error_msg}")
            return False, error_msg
        except Exception as e:
            error_msg = f"Error: {str(e)}"
            print(f"Failed to send email: {error_msg}")
            return False, error_msg
    
    def send_test_email(self, recipient: str) -> tuple[bool, Optional[str]]:
        """Send a test email to verify configuration."""
        subject = "PullBackup - Test Email"
        
        body_html = """
        <html>
            <body style="font-family: Arial, sans-serif; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #14b8a6;">PullBackup Test Email</h2>
                    <p>This is a test email to verify your email configuration.</p>
                    <p>If you're reading this, your email settings are working correctly!</p>
                    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
                    <p style="font-size: 12px; color: #666;">
                        Sent by PullBackup at {timestamp}
                    </p>
                </div>
            </body>
        </html>
        """.format(timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
        
        body_text = f"""
        PullBackup Test Email
        
        This is a test email to verify your email configuration.
        If you're reading this, your email settings are working correctly!
        
        Sent by PullBackup at {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
        """
        
        return self.send_email([recipient], subject, body_html, body_text)
    
    def send_backup_notification(self, backup_history: BackupHistory) -> bool:
        """
        Send notification for backup job completion.
        
        Args:
            backup_history: BackupHistory object with job results
        
        Returns:
            True if notification sent successfully
        """
        settings = self.get_settings()
        
        if not settings or not settings.is_enabled:
            return False
        
        # Check if we should notify for this status
        is_success = backup_history.status.value == 'completed'
        if is_success and not settings.notify_on_success:
            return False
        if not is_success and not settings.notify_on_failure:
            return False
        
        # Get recipients
        if not settings.notify_recipients:
            print("No notification recipients configured")
            return False
        
        recipients = [email.strip() for email in settings.notify_recipients.split(',') if email.strip()]
        if not recipients:
            return False
        
        # Get job and server details
        job = backup_history.backup_job
        server = job.server if job else None
        
        # Prepare email content
        status_word = "Successful" if is_success else "Failed"
        status_color = "#14b8a6" if is_success else "#ef4444"
        
        job_name = job.name if job else "Unknown Job"
        server_name = server.hostname if server else "Unknown Server"
        
        subject = f"PullBackup - Backup {status_word}: {job_name}"
        
        # Format duration
        duration = ""
        if backup_history.started_at and backup_history.completed_at:
            delta = backup_history.completed_at - backup_history.started_at
            minutes, seconds = divmod(delta.total_seconds(), 60)
            duration = f"{int(minutes)}m {int(seconds)}s"
        
        # Format bytes transferred
        bytes_str = ""
        if backup_history.bytes_transferred:
            gb = backup_history.bytes_transferred / (1024**3)
            bytes_str = f"{gb:.2f} GB"
        
        body_html = f"""
        <html>
            <body style="font-family: Arial, sans-serif; color: #333;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: {status_color};">Backup {status_word}</h2>
                    
                    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold; width: 150px;">Job Name:</td>
                                <td style="padding: 8px 0;">{job_name}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold;">Server:</td>
                                <td style="padding: 8px 0;">{server_name}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold;">Status:</td>
                                <td style="padding: 8px 0; color: {status_color};">{status_word}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold;">Started:</td>
                                <td style="padding: 8px 0;">{backup_history.started_at.strftime("%Y-%m-%d %H:%M:%S") if backup_history.started_at else 'N/A'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold;">Completed:</td>
                                <td style="padding: 8px 0;">{backup_history.completed_at.strftime("%Y-%m-%d %H:%M:%S") if backup_history.completed_at else 'N/A'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold;">Duration:</td>
                                <td style="padding: 8px 0;">{duration}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold;">Data Transferred:</td>
                                <td style="padding: 8px 0;">{bytes_str}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; font-weight: bold;">Files Transferred:</td>
                                <td style="padding: 8px 0;">{backup_history.files_transferred:,}</td>
                            </tr>
                        </table>
                    </div>
        """
        
        # Add error message if failed
        if not is_success and backup_history.error_message:
            body_html += f"""
                    <div style="background-color: #fee; padding: 15px; border-left: 4px solid #ef4444; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #ef4444;">Error Details:</h3>
                        <pre style="white-space: pre-wrap; font-family: monospace; font-size: 12px;">{backup_history.error_message}</pre>
                    </div>
            """
        
        body_html += """
                    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
                    <p style="font-size: 12px; color: #666;">
                        This is an automated notification from PullBackup.
                    </p>
                </div>
            </body>
        </html>
        """
        
        # Plain text version
        body_text = f"""
        Backup {status_word}
        
        Job Name: {job_name}
        Server: {server_name}
        Status: {status_word}
        Started: {backup_history.started_at.strftime("%Y-%m-%d %H:%M:%S") if backup_history.started_at else 'N/A'}
        Completed: {backup_history.completed_at.strftime("%Y-%m-%d %H:%M:%S") if backup_history.completed_at else 'N/A'}
        Duration: {duration}
        Data Transferred: {bytes_str}
        Files Transferred: {backup_history.files_transferred:,}
        """
        
        if not is_success and backup_history.error_message:
            body_text += f"\n\nError Details:\n{backup_history.error_message}\n"
        
        body_text += "\n\nThis is an automated notification from PullBackup."
        
        success, _ = self.send_email(recipients, subject, body_html, body_text)
        return success

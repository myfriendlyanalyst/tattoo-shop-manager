-- Updates operations email templates from C:/Users/USER/Downloads/Oyabun tattoo.zip.
-- Run this after docs/operations_email_templates_migration.sql has been applied.
-- The followup-sumi.html design is not inserted because the app does not yet have a follow-up email trigger.

with zipped_templates(template_key, subject, body_html, enabled, test_mode) as (
  values
  ($$request_auto_reply$$, $$We received your tattoo request$$, $$<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<title>Oyabun Tattoo ??Request Received</title>
<link href="https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@500;600;700;800&display=swap" rel="stylesheet" />
<style>
  body { margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
  a { text-decoration: none; }
  .serif { font-family: 'Shippori Mincho B1', 'Yu Mincho', 'Hiragino Mincho ProN', Georgia, 'Times New Roman', serif; }
  @media only screen and (max-width: 620px) {
    .container { width: 100% !important; }
    .px { padding-left: 28px !important; padding-right: 28px !important; }
    .h1 { font-size: 30px !important; line-height: 38px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#ddd8cb;">
<!-- preheader -->
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all; opacity:0; color:#ddd8cb; font-size:1px; line-height:1px;">
  We've received your request and are reviewing the details to match you with the right artist. &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ddd8cb;">
  <tr>
    <td align="center" style="padding:40px 16px 48px 16px;">

      <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="container" style="width:600px; max-width:600px; background-color:#f4efe3;">

        <!-- black masthead with logo -->
        <tr>
          <td align="center" bgcolor="#1a1813" style="background-color:#1a1813; padding:36px 50px 32px 50px; border-bottom:2px solid #d9a534;" class="px">
            <img src="https://tattoo-shop-manager-navy.vercel.app/oyabun-logo-gold.png" alt="Oyabun Tattoo" width="230" style="width:230px; height:auto; display:inline-block; border:0;" />
            <div class="serif" style="font-family:'Shippori Mincho B1',serif; font-size:12px; letter-spacing:5px; color:#cfc8b6; padding-top:12px;">SAN DIEGO</div>
          </td>
        </tr>

        <!-- eyebrow + headline -->
        <tr>
          <td style="padding:38px 50px 0 50px;" class="px">
            <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:11px; letter-spacing:4px; color:#b3841a; text-transform:uppercase; font-weight:700;">Request Received</div>
            <div class="serif h1" style="font-family:'Shippori Mincho B1',serif; font-size:34px; line-height:42px; font-weight:700; color:#1a1813; padding-top:14px;">Thank you for reaching<br />out to Oyabun Tattoo.</div>
            <div style="width:48px; height:2px; background-color:#d9a534; line-height:2px; font-size:0; margin-top:24px;">&nbsp;</div>
          </td>
        </tr>

        <!-- body -->
        <tr>
          <td style="padding:26px 50px 0 50px;" class="px">
            <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:15px; line-height:26px; color:#54503f;">
              We have successfully received your request and our team will review the details shortly.<br /><br />{{artistPreferenceMessage}}<br /><br />{{requestSummaryHtml}}
            </div>
          </td>
        </tr>

        <!-- highlight bar -->
        <tr>
          <td style="padding:28px 50px 0 50px;" class="px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ece6d6; border-left:3px solid #d9a534;">
              <tr>
                <td style="padding:20px 24px; font-family:'Helvetica Neue',Arial,sans-serif; font-size:16px; line-height:25px; color:#1a1813;">
                  Our team typically responds within <b style="color:#b3841a;">1-2 business days</b>.
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- review note -->
        <tr>
          <td style="padding:28px 50px 0 50px;" class="px">
            <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:15px; line-height:26px; color:#54503f;">
              At this stage, no artist, price, or appointment time has been confirmed yet. We will review your idea first and contact you with the next step.
            </div>
            <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:15px; line-height:26px; color:#54503f; padding-top:18px;">
              If we need more details before assigning an artist or sending next steps, we will contact you by email.
            </div>
          </td>
        </tr>

        <!-- follow-up note -->
        <tr>
          <td style="padding:30px 50px 0 50px;" class="px">
            <div style="height:1px; background-color:#d8d1bf; line-height:1px; font-size:0;">&nbsp;</div>
            <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:13px; line-height:22px; color:#8a8474; padding-top:20px;">
              If you do not hear back from us within a reasonable timeframe, please don't hesitate to follow up with us again.
            </div>
          </td>
        </tr>

        <!-- closing line -->
        <tr>
          <td align="center" style="padding:34px 50px 40px 50px;" class="px">
            <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:11px; letter-spacing:3px; color:#8a8474; text-transform:uppercase; line-height:20px;">We appreciate your patience</div>
            <div class="serif" style="font-family:'Shippori Mincho B1',serif; font-size:17px; letter-spacing:1px; color:#b3841a; padding-top:8px;">and look forward to connecting with you soon.</div>
          </td>
        </tr>

        <!-- footer -->
        <tr>
          <td align="center" style="background-color:#1a1813; padding:30px 50px 32px 50px;" class="px">
            <div class="serif" style="font-family:'Shippori Mincho B1',serif; font-size:13px; letter-spacing:5px; color:#d9c79a; text-transform:uppercase;">Oyabun Tattoo</div>
            <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:11px; letter-spacing:3px; color:#857f72; text-transform:uppercase; padding-top:6px;">San Diego, California</div>
            <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:12px; line-height:20px; color:#9a9486; padding-top:16px;">
              <a href="tel:8583846099" style="color:#cfc8b6;">858-384-6099</a> &nbsp;&middot;&nbsp; <a href="&#109;&#97;&#105;&#108;&#116;&#111;&#58;&#99;&#111;&#110;&#116;&#97;&#99;&#116;&#64;&#111;&#121;&#97;&#98;&#117;&#110;&#116;&#97;&#116;&#116;&#111;&#111;&#46;&#99;&#111;&#109;" style="color:#cfc8b6;">&#99;&#111;&#110;&#116;&#97;&#99;&#116;&#64;&#111;&#121;&#97;&#98;&#117;&#110;&#116;&#97;&#116;&#116;&#111;&#111;&#46;&#99;&#111;&#109;</a>
            </div>
            <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:11px; line-height:18px; color:#857f72; padding-top:14px;">
              <a href="https://oyabuntattoo.com" style="color:#9a9486;">Website</a> &nbsp;&middot;&nbsp; <a href="https://shop.oyabuntattoo.com" style="color:#9a9486;">Shop</a> &nbsp;&middot;&nbsp; <a href="https://oyabuntattoo.com/aftercare" style="color:#9a9486;">Aftercare</a> &nbsp;&middot;&nbsp; <a href="https://oyabuntattoo.com/faq" style="color:#9a9486;">FAQ</a>
            </div>
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>
</body>
</html>
$$, false, true),
  ($$appointment_confirmation_1$$, $$Your appointment is confirmed$$, $$<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<title>Oyabun Tattoo ??Appointment Confirmed</title>
<link href="https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@500;600;700;800&display=swap" rel="stylesheet" />
<style>
  body { margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
  a { text-decoration: none; }
  .serif { font-family: 'Shippori Mincho B1', 'Yu Mincho', 'Hiragino Mincho ProN', Georgia, 'Times New Roman', serif; }
  @media only screen and (max-width: 620px) {
    .container { width: 100% !important; }
    .px { padding-left: 26px !important; padding-right: 26px !important; }
    .h1 { font-size: 30px !important; line-height: 36px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#ddd8cb;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all; opacity:0; color:#ddd8cb; font-size:1px; line-height:1px;">
  Your appointment with Oyabun Tattoo is confirmed. Here are the details. &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ddd8cb;">
  <tr>
    <td align="center" style="padding:40px 16px 48px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="container" style="width:600px; max-width:600px; background-color:#f4efe3;">

        <!-- masthead -->
        <tr>
          <td align="center" bgcolor="#1a1813" style="background-color:#1a1813; padding:34px 50px 30px 50px; border-bottom:2px solid #d9a534;" class="px">
            <img src="https://tattoo-shop-manager-navy.vercel.app/oyabun-logo-gold.png" alt="Oyabun Tattoo" width="210" style="width:210px; height:auto; display:inline-block; border:0;" />
            <div class="serif" style="font-family:'Shippori Mincho B1',serif; font-size:12px; letter-spacing:5px; color:#cfc8b6; padding-top:12px;">SAN DIEGO</div>
          </td>
        </tr>

        <!-- eyebrow -->
        <tr>
          <td align="center" style="padding:36px 50px 0 50px;" class="px">
            <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:11px; letter-spacing:4px; color:#b3841a; text-transform:uppercase; font-weight:700;">Appointment Confirmed</div>
          </td>
        </tr>

        <!-- confirmation card -->
        <tr>
          <td style="padding:22px 50px 0 50px;" class="px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #d9a534; background-color:#fbf8ef;">
              <tr>
                <td align="center" style="padding:30px 30px 28px 30px;">
                  <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:13px; letter-spacing:1px; color:#8a8474;">Confirmed booking for</div>
                  <div class="serif h1" style="font-family:'Shippori Mincho B1',serif; font-size:30px; line-height:36px; font-weight:700; color:#1a1813; padding-top:8px;">{{customerName}}</div>

                  <div style="height:1px; background-color:#e6dfcc; line-height:1px; font-size:0; margin:24px 0;">&nbsp;</div>

                  <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:14px; color:#54503f;">Your appointment with</div>
                  <div class="serif" style="font-family:'Shippori Mincho B1',serif; font-size:21px; color:#1a1813; font-weight:700; padding-top:8px;">{{artistName}}</div>
                  <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:14px; color:#54503f; padding-top:8px;">has been successfully scheduled for:</div>
                  <div class="serif" style="font-family:'Shippori Mincho B1',serif; font-size:20px; color:#b3841a; font-weight:700; padding-top:12px;">{{appointmentTime}}</div>

                  <div style="height:1px; background-color:#e6dfcc; line-height:1px; font-size:0; margin:24px 0;">&nbsp;</div>

                  <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:13px; line-height:21px; color:#6b6557;">
                    To reschedule, please call <a href="tel:8583846099" style="color:#b3841a;">858-384-6099</a> or reply to this email <b style="color:#1a1813;">immediately</b> to avoid any deposit loss.
                  </div>
                  <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin-top:18px;">
                    <tr>
                      <td bgcolor="#d9a534" style="border-radius:100px;">
                        <a href="https://oyabuntattoo.com/faq" style="display:inline-block; padding:12px 26px; font-family:'Helvetica Neue',Arial,sans-serif; font-size:11px; letter-spacing:2px; color:#1a1813; text-transform:uppercase; font-weight:700;">Check the deposit policy</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- action buttons -->
        <tr>
          <td style="padding:28px 50px 0 50px;" class="px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr><td bgcolor="#1a1813" style="border-radius:3px;"><a href="https://oyabuntattoo.com/aftercare" style="display:block; padding:15px 18px; text-align:center; font-family:'Helvetica Neue',Arial,sans-serif; font-size:12px; letter-spacing:2px; color:#f4efe3; text-transform:uppercase; font-weight:600;">Prepare for my tattoo session</a></td></tr>
              <tr><td style="height:10px; line-height:10px; font-size:0;">&nbsp;</td></tr>
              <tr><td bgcolor="#1a1813" style="border-radius:3px;"><a href="https://oyabuntattoo.com/aftercare" style="display:block; padding:15px 18px; text-align:center; font-family:'Helvetica Neue',Arial,sans-serif; font-size:12px; letter-spacing:2px; color:#f4efe3; text-transform:uppercase; font-weight:600;">Check aftercare tips</a></td></tr>
              <tr><td style="height:10px; line-height:10px; font-size:0;">&nbsp;</td></tr>
              <tr><td bgcolor="#2c281f" style="border-radius:3px;"><a href="{{icalLink}}" style="display:block; padding:15px 18px; text-align:center; font-family:'Helvetica Neue',Arial,sans-serif; font-size:12px; letter-spacing:2px; color:#e7e0cf; text-transform:uppercase; font-weight:600;">Add to iCal / Outlook</a></td></tr>
              <tr><td style="height:10px; line-height:10px; font-size:0;">&nbsp;</td></tr>
              <tr><td bgcolor="#2c281f" style="border-radius:3px;"><a href="{{googleCalendarLink}}" style="display:block; padding:15px 18px; text-align:center; font-family:'Helvetica Neue',Arial,sans-serif; font-size:12px; letter-spacing:2px; color:#e7e0cf; text-transform:uppercase; font-weight:600;">Add to Google Calendar</a></td></tr>
            </table>
          </td>
        </tr>

        <!-- support / review -->
        <tr>
          <td align="center" style="padding:36px 50px 38px 50px;" class="px">
            <div style="height:1px; background-color:#d8d1bf; line-height:1px; font-size:0; margin-bottom:28px;">&nbsp;</div>
            <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:22px; letter-spacing:5px; color:#d9a534;">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
            <div class="serif" style="font-family:'Shippori Mincho B1',serif; font-size:23px; color:#1a1813; font-weight:700; padding-top:12px;">Support us</div>
            <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:14px; line-height:23px; color:#54503f; padding-top:10px; max-width:380px; margin:0 auto;">Your feedback helps our artists continue to create great tattoos. Take a few minutes to share your experience.</div>
            <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin-top:20px;">
              <tr>
                <td bgcolor="#d9a534" style="border-radius:100px;">
                  <a href="https://g.page/r/oyabuntattoo/review" style="display:inline-block; padding:14px 30px; font-family:'Helvetica Neue',Arial,sans-serif; font-size:12px; letter-spacing:2px; color:#1a1813; text-transform:uppercase; font-weight:700;">Review us on Google</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- footer -->
        <tr>
          <td align="center" style="background-color:#1a1813; padding:30px 50px 32px 50px;" class="px">
            <div class="serif" style="font-family:'Shippori Mincho B1',serif; font-size:13px; letter-spacing:5px; color:#d9c79a; text-transform:uppercase;">Oyabun Tattoo</div>
            <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:11px; letter-spacing:3px; color:#857f72; text-transform:uppercase; padding-top:6px;">San Diego, California</div>
            <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:12px; line-height:20px; color:#9a9486; padding-top:16px;">
              <a href="tel:8583846099" style="color:#cfc8b6;">858-384-6099</a> &nbsp;&middot;&nbsp; <a href="&#109;&#97;&#105;&#108;&#116;&#111;&#58;&#99;&#111;&#110;&#116;&#97;&#99;&#116;&#64;&#111;&#121;&#97;&#98;&#117;&#110;&#116;&#97;&#116;&#116;&#111;&#111;&#46;&#99;&#111;&#109;" style="color:#cfc8b6;">&#99;&#111;&#110;&#116;&#97;&#99;&#116;&#64;&#111;&#121;&#97;&#98;&#117;&#110;&#116;&#97;&#116;&#116;&#111;&#111;&#46;&#99;&#111;&#109;</a>
            </div>
            <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:11px; line-height:18px; color:#857f72; padding-top:14px;">
              <a href="https://oyabuntattoo.com" style="color:#9a9486;">Website</a> &nbsp;&middot;&nbsp; <a href="https://shop.oyabuntattoo.com" style="color:#9a9486;">Shop</a> &nbsp;&middot;&nbsp; <a href="https://oyabuntattoo.com/aftercare" style="color:#9a9486;">Aftercare</a> &nbsp;&middot;&nbsp; <a href="https://oyabuntattoo.com/faq" style="color:#9a9486;">FAQ</a>
            </div>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>
$$, true, false),
  ($$appointment_confirmation_2$$, $$Your next appointment is confirmed$$, $$<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<title>Oyabun Tattoo ??Next Appointment Confirmed</title>
<link href="https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@500;600;700;800&display=swap" rel="stylesheet" />
<style>
  body { margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
  a { text-decoration: none; }
  .serif { font-family: 'Shippori Mincho B1', 'Yu Mincho', 'Hiragino Mincho ProN', Georgia, 'Times New Roman', serif; }
  @media only screen and (max-width: 620px) {
    .container { width: 100% !important; }
    .px { padding-left: 26px !important; padding-right: 26px !important; }
    .h1 { font-size: 30px !important; line-height: 36px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#ddd8cb;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all; opacity:0; color:#ddd8cb; font-size:1px; line-height:1px;">
  Your appointment with Oyabun Tattoo is confirmed. Here are the details. &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ddd8cb;">
  <tr>
    <td align="center" style="padding:40px 16px 48px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="container" style="width:600px; max-width:600px; background-color:#f4efe3;">

        <!-- masthead -->
        <tr>
          <td align="center" bgcolor="#1a1813" style="background-color:#1a1813; padding:34px 50px 30px 50px; border-bottom:2px solid #d9a534;" class="px">
            <img src="https://tattoo-shop-manager-navy.vercel.app/oyabun-logo-gold.png" alt="Oyabun Tattoo" width="210" style="width:210px; height:auto; display:inline-block; border:0;" />
            <div class="serif" style="font-family:'Shippori Mincho B1',serif; font-size:12px; letter-spacing:5px; color:#cfc8b6; padding-top:12px;">SAN DIEGO</div>
          </td>
        </tr>

        <!-- eyebrow -->
        <tr>
          <td align="center" style="padding:36px 50px 0 50px;" class="px">
            <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:11px; letter-spacing:4px; color:#b3841a; text-transform:uppercase; font-weight:700;">Appointment Confirmed</div>
          </td>
        </tr>

        <!-- confirmation card -->
        <tr>
          <td style="padding:22px 50px 0 50px;" class="px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #d9a534; background-color:#fbf8ef;">
              <tr>
                <td align="center" style="padding:30px 30px 28px 30px;">
                  <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:13px; letter-spacing:1px; color:#8a8474;">Confirmed booking for</div>
                  <div class="serif h1" style="font-family:'Shippori Mincho B1',serif; font-size:30px; line-height:36px; font-weight:700; color:#1a1813; padding-top:8px;">{{customerName}}</div>

                  <div style="height:1px; background-color:#e6dfcc; line-height:1px; font-size:0; margin:24px 0;">&nbsp;</div>

                  <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:14px; color:#54503f;">Your <i>next</i> appointment with</div>
                  <div class="serif" style="font-family:'Shippori Mincho B1',serif; font-size:21px; color:#1a1813; font-weight:700; padding-top:8px;">{{artistName}}</div>
                  <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:14px; color:#54503f; padding-top:8px;">has been successfully scheduled for:</div>
                  <div class="serif" style="font-family:'Shippori Mincho B1',serif; font-size:20px; color:#b3841a; font-weight:700; padding-top:12px;">{{appointmentTime}}</div>

                  <div style="height:1px; background-color:#e6dfcc; line-height:1px; font-size:0; margin:24px 0;">&nbsp;</div>

                  <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:13px; line-height:21px; color:#6b6557;">
                    To reschedule, please call <a href="tel:8583846099" style="color:#b3841a;">858-384-6099</a> or reply to this email <b style="color:#1a1813;">immediately</b> to avoid any deposit loss.
                  </div>
                  <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin-top:18px;">
                    <tr>
                      <td bgcolor="#d9a534" style="border-radius:100px;">
                        <a href="https://oyabuntattoo.com/faq" style="display:inline-block; padding:12px 26px; font-family:'Helvetica Neue',Arial,sans-serif; font-size:11px; letter-spacing:2px; color:#1a1813; text-transform:uppercase; font-weight:700;">Check the deposit policy</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- action buttons -->
        <tr>
          <td style="padding:28px 50px 0 50px;" class="px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr><td bgcolor="#1a1813" style="border-radius:3px;"><a href="https://oyabuntattoo.com/aftercare" style="display:block; padding:15px 18px; text-align:center; font-family:'Helvetica Neue',Arial,sans-serif; font-size:12px; letter-spacing:2px; color:#f4efe3; text-transform:uppercase; font-weight:600;">Prepare for my tattoo session</a></td></tr>
              <tr><td style="height:10px; line-height:10px; font-size:0;">&nbsp;</td></tr>
              <tr><td bgcolor="#1a1813" style="border-radius:3px;"><a href="https://oyabuntattoo.com/aftercare" style="display:block; padding:15px 18px; text-align:center; font-family:'Helvetica Neue',Arial,sans-serif; font-size:12px; letter-spacing:2px; color:#f4efe3; text-transform:uppercase; font-weight:600;">Check aftercare tips</a></td></tr>
              <tr><td style="height:10px; line-height:10px; font-size:0;">&nbsp;</td></tr>
              <tr><td bgcolor="#2c281f" style="border-radius:3px;"><a href="{{icalLink}}" style="display:block; padding:15px 18px; text-align:center; font-family:'Helvetica Neue',Arial,sans-serif; font-size:12px; letter-spacing:2px; color:#e7e0cf; text-transform:uppercase; font-weight:600;">Add to iCal / Outlook</a></td></tr>
              <tr><td style="height:10px; line-height:10px; font-size:0;">&nbsp;</td></tr>
              <tr><td bgcolor="#2c281f" style="border-radius:3px;"><a href="{{googleCalendarLink}}" style="display:block; padding:15px 18px; text-align:center; font-family:'Helvetica Neue',Arial,sans-serif; font-size:12px; letter-spacing:2px; color:#e7e0cf; text-transform:uppercase; font-weight:600;">Add to Google Calendar</a></td></tr>
            </table>
          </td>
        </tr>

        <!-- support / review -->
        <tr>
          <td align="center" style="padding:36px 50px 38px 50px;" class="px">
            <div style="height:1px; background-color:#d8d1bf; line-height:1px; font-size:0; margin-bottom:28px;">&nbsp;</div>
            <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:22px; letter-spacing:5px; color:#d9a534;">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
            <div class="serif" style="font-family:'Shippori Mincho B1',serif; font-size:23px; color:#1a1813; font-weight:700; padding-top:12px;">Support us</div>
            <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:14px; line-height:23px; color:#54503f; padding-top:10px; max-width:380px; margin:0 auto;">Your feedback helps our artists continue to create great tattoos. Take a few minutes to share your experience at Oyabun Tattoo with our community.</div>
            <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin-top:20px;">
              <tr>
                <td bgcolor="#d9a534" style="border-radius:100px;">
                  <a href="https://g.page/r/oyabuntattoo/review" style="display:inline-block; padding:14px 30px; font-family:'Helvetica Neue',Arial,sans-serif; font-size:12px; letter-spacing:2px; color:#1a1813; text-transform:uppercase; font-weight:700;">Review us on Google</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- footer -->
        <tr>
          <td align="center" style="background-color:#1a1813; padding:30px 50px 32px 50px;" class="px">
            <div class="serif" style="font-family:'Shippori Mincho B1',serif; font-size:13px; letter-spacing:5px; color:#d9c79a; text-transform:uppercase;">Oyabun Tattoo</div>
            <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:11px; letter-spacing:3px; color:#857f72; text-transform:uppercase; padding-top:6px;">San Diego, California</div>
            <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:12px; line-height:20px; color:#9a9486; padding-top:16px;">
              <a href="tel:8583846099" style="color:#cfc8b6;">858-384-6099</a> &nbsp;&middot;&nbsp; <a href="&#109;&#97;&#105;&#108;&#116;&#111;&#58;&#99;&#111;&#110;&#116;&#97;&#99;&#116;&#64;&#111;&#121;&#97;&#98;&#117;&#110;&#116;&#97;&#116;&#116;&#111;&#111;&#46;&#99;&#111;&#109;" style="color:#cfc8b6;">&#99;&#111;&#110;&#116;&#97;&#99;&#116;&#64;&#111;&#121;&#97;&#98;&#117;&#110;&#116;&#97;&#116;&#116;&#111;&#111;&#46;&#99;&#111;&#109;</a>
            </div>
            <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:11px; line-height:18px; color:#857f72; padding-top:14px;">
              <a href="https://oyabuntattoo.com" style="color:#9a9486;">Website</a> &nbsp;&middot;&nbsp; <a href="https://shop.oyabuntattoo.com" style="color:#9a9486;">Shop</a> &nbsp;&middot;&nbsp; <a href="https://oyabuntattoo.com/aftercare" style="color:#9a9486;">Aftercare</a> &nbsp;&middot;&nbsp; <a href="https://oyabuntattoo.com/faq" style="color:#9a9486;">FAQ</a>
            </div>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>
$$, true, false),
  ($$appointment_reschedule$$, $$Your appointment has been rescheduled$$, $$<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<title>Oyabun Tattoo ??Appointment Rescheduled</title>
<link href="https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@500;600;700;800&display=swap" rel="stylesheet" />
<style>
  body { margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
  a { text-decoration: none; }
  .serif { font-family: 'Shippori Mincho B1', 'Yu Mincho', 'Hiragino Mincho ProN', Georgia, 'Times New Roman', serif; }
  @media only screen and (max-width: 620px) {
    .container { width: 100% !important; }
    .px { padding-left: 26px !important; padding-right: 26px !important; }
    .h1 { font-size: 30px !important; line-height: 36px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#ddd8cb;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all; opacity:0; color:#ddd8cb; font-size:1px; line-height:1px;">
  Your appointment with Oyabun Tattoo has been rescheduled. Here are the new details. &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ddd8cb;">
  <tr>
    <td align="center" style="padding:40px 16px 48px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="container" style="width:600px; max-width:600px; background-color:#f4efe3;">

        <!-- masthead -->
        <tr>
          <td align="center" bgcolor="#1a1813" style="background-color:#1a1813; padding:34px 50px 30px 50px; border-bottom:2px solid #d9a534;" class="px">
            <img src="https://tattoo-shop-manager-navy.vercel.app/oyabun-logo-gold.png" alt="Oyabun Tattoo" width="210" style="width:210px; height:auto; display:inline-block; border:0;" />
            <div class="serif" style="font-family:'Shippori Mincho B1',serif; font-size:12px; letter-spacing:5px; color:#cfc8b6; padding-top:12px;">SAN DIEGO</div>
          </td>
        </tr>

        <!-- eyebrow -->
        <tr>
          <td align="center" style="padding:36px 50px 0 50px;" class="px">
            <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:11px; letter-spacing:4px; color:#b3841a; text-transform:uppercase; font-weight:700;">Appointment Rescheduled</div>
          </td>
        </tr>

        <!-- card -->
        <tr>
          <td style="padding:22px 50px 0 50px;" class="px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #d9a534; background-color:#fbf8ef;">
              <tr>
                <td align="center" style="padding:30px 30px 28px 30px;">
                  <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:13px; letter-spacing:1px; color:#8a8474;">Updated booking for</div>
                  <div class="serif h1" style="font-family:'Shippori Mincho B1',serif; font-size:30px; line-height:36px; font-weight:700; color:#1a1813; padding-top:8px;">{{customerName}}</div>

                  <div style="height:1px; background-color:#e6dfcc; line-height:1px; font-size:0; margin:24px 0;">&nbsp;</div>

                  <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:14px; color:#54503f;">Your appointment with</div>
                  <div class="serif" style="font-family:'Shippori Mincho B1',serif; font-size:21px; color:#1a1813; font-weight:700; padding-top:8px;">{{artistName}}</div>
                  <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:14px; color:#54503f; padding-top:8px;">has been moved to a new time:</div>

                  <!-- old -> new -->
                  <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:13px; color:#a39c8b; padding-top:14px; text-decoration:line-through;">{{oldAppointmentTime}}</div>
                  <div class="serif" style="font-family:'Shippori Mincho B1',serif; font-size:20px; color:#b3841a; font-weight:700; padding-top:8px;">{{newAppointmentTime}}</div>

                  <div style="height:1px; background-color:#e6dfcc; line-height:1px; font-size:0; margin:24px 0;">&nbsp;</div>

                  <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:13px; line-height:21px; color:#6b6557;">
                    Need to change it again? Call <a href="tel:8583846099" style="color:#b3841a;">858-384-6099</a> or reply to this email <b style="color:#1a1813;">immediately</b> to avoid any deposit loss.
                  </div>
                  <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin-top:18px;">
                    <tr>
                      <td bgcolor="#d9a534" style="border-radius:100px;">
                        <a href="https://oyabuntattoo.com/faq" style="display:inline-block; padding:12px 26px; font-family:'Helvetica Neue',Arial,sans-serif; font-size:11px; letter-spacing:2px; color:#1a1813; text-transform:uppercase; font-weight:700;">Check the deposit policy</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- update calendar -->
        <tr>
          <td style="padding:28px 50px 0 50px;" class="px">
            <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:11px; letter-spacing:2px; color:#8a8474; text-transform:uppercase; padding-bottom:14px;">Update your calendar</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr><td bgcolor="#2c281f" style="border-radius:3px;"><a href="{{icalLink}}" style="display:block; padding:15px 18px; text-align:center; font-family:'Helvetica Neue',Arial,sans-serif; font-size:12px; letter-spacing:2px; color:#e7e0cf; text-transform:uppercase; font-weight:600;">Add to iCal / Outlook</a></td></tr>
              <tr><td style="height:10px; line-height:10px; font-size:0;">&nbsp;</td></tr>
              <tr><td bgcolor="#2c281f" style="border-radius:3px;"><a href="{{googleCalendarLink}}" style="display:block; padding:15px 18px; text-align:center; font-family:'Helvetica Neue',Arial,sans-serif; font-size:12px; letter-spacing:2px; color:#e7e0cf; text-transform:uppercase; font-weight:600;">Add to Google Calendar</a></td></tr>
            </table>
          </td>
        </tr>

        <!-- footer -->
        <tr>
          <td align="center" style="background-color:#1a1813; padding:34px 50px 32px 50px; margin-top:0;" class="px">
            <div class="serif" style="font-family:'Shippori Mincho B1',serif; font-size:13px; letter-spacing:5px; color:#d9c79a; text-transform:uppercase;">Oyabun Tattoo</div>
            <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:11px; letter-spacing:3px; color:#857f72; text-transform:uppercase; padding-top:6px;">San Diego, California</div>
            <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:12px; line-height:20px; color:#9a9486; padding-top:16px;">
              <a href="tel:8583846099" style="color:#cfc8b6;">858-384-6099</a> &nbsp;&middot;&nbsp; <a href="&#109;&#97;&#105;&#108;&#116;&#111;&#58;&#99;&#111;&#110;&#116;&#97;&#99;&#116;&#64;&#111;&#121;&#97;&#98;&#117;&#110;&#116;&#97;&#116;&#116;&#111;&#111;&#46;&#99;&#111;&#109;" style="color:#cfc8b6;">&#99;&#111;&#110;&#116;&#97;&#99;&#116;&#64;&#111;&#121;&#97;&#98;&#117;&#110;&#116;&#97;&#116;&#116;&#111;&#111;&#46;&#99;&#111;&#109;</a>
            </div>
            <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:11px; line-height:18px; color:#857f72; padding-top:14px;">
              <a href="https://oyabuntattoo.com" style="color:#9a9486;">Website</a> &nbsp;&middot;&nbsp; <a href="https://shop.oyabuntattoo.com" style="color:#9a9486;">Shop</a> &nbsp;&middot;&nbsp; <a href="https://oyabuntattoo.com/aftercare" style="color:#9a9486;">Aftercare</a> &nbsp;&middot;&nbsp; <a href="https://oyabuntattoo.com/faq" style="color:#9a9486;">FAQ</a>
            </div>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>
$$, true, false),
  ($$appointment_cancellation$$, $$Your appointment has been canceled$$, $$<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<title>Oyabun Tattoo ??Appointment Cancelled</title>
<link href="https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@500;600;700;800&display=swap" rel="stylesheet" />
<style>
  body { margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
  a { text-decoration: none; }
  .serif { font-family: 'Shippori Mincho B1', 'Yu Mincho', 'Hiragino Mincho ProN', Georgia, 'Times New Roman', serif; }
  @media only screen and (max-width: 620px) {
    .container { width: 100% !important; }
    .px { padding-left: 26px !important; padding-right: 26px !important; }
    .h1 { font-size: 30px !important; line-height: 36px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#ddd8cb;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all; opacity:0; color:#ddd8cb; font-size:1px; line-height:1px;">
  Your appointment with Oyabun Tattoo has been cancelled. We hope to see you again soon. &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ddd8cb;">
  <tr>
    <td align="center" style="padding:40px 16px 48px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="container" style="width:600px; max-width:600px; background-color:#f4efe3;">

        <!-- masthead -->
        <tr>
          <td align="center" bgcolor="#1a1813" style="background-color:#1a1813; padding:34px 50px 30px 50px; border-bottom:2px solid #d9a534;" class="px">
            <img src="https://tattoo-shop-manager-navy.vercel.app/oyabun-logo-gold.png" alt="Oyabun Tattoo" width="210" style="width:210px; height:auto; display:inline-block; border:0;" />
            <div class="serif" style="font-family:'Shippori Mincho B1',serif; font-size:12px; letter-spacing:5px; color:#cfc8b6; padding-top:12px;">SAN DIEGO</div>
          </td>
        </tr>

        <!-- eyebrow -->
        <tr>
          <td align="center" style="padding:36px 50px 0 50px;" class="px">
            <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:11px; letter-spacing:4px; color:#9a7b6f; text-transform:uppercase; font-weight:700;">Appointment Cancelled</div>
          </td>
        </tr>

        <!-- card -->
        <tr>
          <td style="padding:22px 50px 0 50px;" class="px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #d8d1bf; background-color:#fbf8ef;">
              <tr>
                <td align="center" style="padding:30px 30px 28px 30px;">
                  <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:13px; letter-spacing:1px; color:#8a8474;">Cancelled booking for</div>
                  <div class="serif h1" style="font-family:'Shippori Mincho B1',serif; font-size:30px; line-height:36px; font-weight:700; color:#1a1813; padding-top:8px;">{{customerName}}</div>

                  <div style="height:1px; background-color:#e6dfcc; line-height:1px; font-size:0; margin:24px 0;">&nbsp;</div>

                  <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:14px; line-height:23px; color:#54503f;">Your appointment with <b style="color:#1a1813;">{{artistName}}</b> on</div>
                  <div class="serif" style="font-family:'Shippori Mincho B1',serif; font-size:19px; color:#1a1813; font-weight:700; padding-top:10px; text-decoration:line-through; text-decoration-color:#c9b88f;">{{appointmentTime}}</div>
                  <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:14px; color:#54503f; padding-top:10px;">has been cancelled.</div>

                  <div style="height:1px; background-color:#e6dfcc; line-height:1px; font-size:0; margin:24px 0;">&nbsp;</div>

                  <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:13px; line-height:21px; color:#6b6557;">
                    Deposits are handled per our policy. If you believe this was a mistake, call <a href="tel:8583846099" style="color:#b3841a;">858-384-6099</a> or reply to this email and we'll make it right.
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- rebook -->
        <tr>
          <td align="center" style="padding:30px 50px 0 50px;" class="px">
            <div class="serif" style="font-family:'Shippori Mincho B1',serif; font-size:20px; color:#1a1813;">Changed your mind?</div>
            <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:14px; line-height:23px; color:#54503f; padding-top:10px; max-width:400px; margin:0 auto;">The chair is always here when you're ready. Start a new request and we'll match you with the right artist.</div>
            <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin-top:20px;">
              <tr>
                <td bgcolor="#1a1813" style="border-radius:3px;">
                  <a href="https://oyabuntattoo.com/request" style="display:inline-block; padding:16px 38px; font-family:'Helvetica Neue',Arial,sans-serif; font-size:12px; letter-spacing:3px; color:#f4efe3; text-transform:uppercase; font-weight:700;">Request a new appointment</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- footer -->
        <tr>
          <td align="center" style="background-color:#1a1813; padding:36px 50px 32px 50px;" class="px">
            <div class="serif" style="font-family:'Shippori Mincho B1',serif; font-size:13px; letter-spacing:5px; color:#d9c79a; text-transform:uppercase;">Oyabun Tattoo</div>
            <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:11px; letter-spacing:3px; color:#857f72; text-transform:uppercase; padding-top:6px;">San Diego, California</div>
            <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:12px; line-height:20px; color:#9a9486; padding-top:16px;">
              <a href="tel:8583846099" style="color:#cfc8b6;">858-384-6099</a> &nbsp;&middot;&nbsp; <a href="&#109;&#97;&#105;&#108;&#116;&#111;&#58;&#99;&#111;&#110;&#116;&#97;&#99;&#116;&#64;&#111;&#121;&#97;&#98;&#117;&#110;&#116;&#97;&#116;&#116;&#111;&#111;&#46;&#99;&#111;&#109;" style="color:#cfc8b6;">&#99;&#111;&#110;&#116;&#97;&#99;&#116;&#64;&#111;&#121;&#97;&#98;&#117;&#110;&#116;&#97;&#116;&#116;&#111;&#111;&#46;&#99;&#111;&#109;</a>
            </div>
            <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:11px; line-height:18px; color:#857f72; padding-top:14px;">
              <a href="https://oyabuntattoo.com" style="color:#9a9486;">Website</a> &nbsp;&middot;&nbsp; <a href="https://shop.oyabuntattoo.com" style="color:#9a9486;">Shop</a> &nbsp;&middot;&nbsp; <a href="https://oyabuntattoo.com/aftercare" style="color:#9a9486;">Aftercare</a> &nbsp;&middot;&nbsp; <a href="https://oyabuntattoo.com/faq" style="color:#9a9486;">FAQ</a>
            </div>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>
$$, true, false),
  ($$appointment_reminder$$, $$Appointment reminder$$, $$<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<title>Oyabun Tattoo ??Appointment Reminder</title>
<link href="https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@500;600;700;800&display=swap" rel="stylesheet" />
<style>
  body { margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
  a { text-decoration: none; }
  .serif { font-family: 'Shippori Mincho B1', 'Yu Mincho', 'Hiragino Mincho ProN', Georgia, 'Times New Roman', serif; }
  @media only screen and (max-width: 620px) {
    .container { width: 100% !important; }
    .px { padding-left: 26px !important; padding-right: 26px !important; }
    .h1 { font-size: 30px !important; line-height: 36px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#ddd8cb;">
<div style="display:none; max-height:0; overflow:hidden; mso-hide:all; opacity:0; color:#ddd8cb; font-size:1px; line-height:1px;">
  Your tattoo session with Oyabun is coming up. Here's how to prepare. &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847; &#847;
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#ddd8cb;">
  <tr>
    <td align="center" style="padding:40px 16px 48px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="container" style="width:600px; max-width:600px; background-color:#f4efe3;">

        <!-- masthead -->
        <tr>
          <td align="center" bgcolor="#1a1813" style="background-color:#1a1813; padding:34px 50px 30px 50px; border-bottom:2px solid #d9a534;" class="px">
            <img src="https://tattoo-shop-manager-navy.vercel.app/oyabun-logo-gold.png" alt="Oyabun Tattoo" width="210" style="width:210px; height:auto; display:inline-block; border:0;" />
            <div class="serif" style="font-family:'Shippori Mincho B1',serif; font-size:12px; letter-spacing:5px; color:#cfc8b6; padding-top:12px;">SAN DIEGO</div>
          </td>
        </tr>

        <!-- eyebrow + headline -->
        <tr>
          <td style="padding:36px 50px 0 50px;" class="px">
            <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:11px; letter-spacing:4px; color:#b3841a; text-transform:uppercase; font-weight:700;">Appointment Reminder</div>
            <div class="serif h1" style="font-family:'Shippori Mincho B1',serif; font-size:34px; line-height:42px; font-weight:700; color:#1a1813; padding-top:14px;">Your session is<br />coming up.</div>
            <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:15px; line-height:26px; color:#54503f; padding-top:16px;">
              Hi {{customerName}}, this is a friendly reminder of your upcoming appointment with <b style="color:#1a1813;">{{artistName}}</b>.
            </div>
          </td>
        </tr>

        <!-- when card -->
        <tr>
          <td style="padding:24px 50px 0 50px;" class="px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #d9a534; background-color:#fbf8ef;">
              <tr>
                <td align="center" style="padding:24px 30px;">
                  <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:10px; letter-spacing:2px; color:#8a8474; text-transform:uppercase;">When</div>
                  <div class="serif" style="font-family:'Shippori Mincho B1',serif; font-size:22px; color:#b3841a; font-weight:700; padding-top:10px;">{{appointmentTime}}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- prep -->
        <tr>
          <td style="padding:30px 50px 0 50px;" class="px">
            <div class="serif" style="font-family:'Shippori Mincho B1',serif; font-size:18px; color:#1a1813;">Before you come in</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding-top:12px;">
              <tr><td style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:14px; line-height:24px; color:#54503f; padding:5px 0;"><span style="color:#b3841a;">&#9670;</span> &nbsp;Get a good night's sleep and eat a solid meal beforehand.</td></tr>
              <tr><td style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:14px; line-height:24px; color:#54503f; padding:5px 0;"><span style="color:#b3841a;">&#9670;</span> &nbsp;Stay hydrated and skip alcohol for 24 hours before.</td></tr>
              <tr><td style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:14px; line-height:24px; color:#54503f; padding:5px 0;"><span style="color:#b3841a;">&#9670;</span> &nbsp;Bring a valid photo ID ??you must be 18 or older.</td></tr>
              <tr><td style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:14px; line-height:24px; color:#54503f; padding:5px 0;"><span style="color:#b3841a;">&#9670;</span> &nbsp;Wear comfortable clothing with access to the placement.</td></tr>
            </table>
          </td>
        </tr>

        <!-- action buttons -->
        <tr>
          <td style="padding:26px 50px 0 50px;" class="px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr><td bgcolor="#1a1813" style="border-radius:3px;"><a href="https://oyabuntattoo.com/aftercare" style="display:block; padding:15px 18px; text-align:center; font-family:'Helvetica Neue',Arial,sans-serif; font-size:12px; letter-spacing:2px; color:#f4efe3; text-transform:uppercase; font-weight:600;">Prepare for my tattoo session</a></td></tr>
              <tr><td style="height:10px; line-height:10px; font-size:0;">&nbsp;</td></tr>
              <tr><td bgcolor="#2c281f" style="border-radius:3px;"><a href="{{googleCalendarLink}}" style="display:block; padding:15px 18px; text-align:center; font-family:'Helvetica Neue',Arial,sans-serif; font-size:12px; letter-spacing:2px; color:#e7e0cf; text-transform:uppercase; font-weight:600;">Add to Google Calendar</a></td></tr>
            </table>
          </td>
        </tr>

        <!-- reschedule note -->
        <tr>
          <td align="center" style="padding:24px 50px 0 50px;" class="px">
            <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:13px; line-height:21px; color:#6b6557;">Can't make it? Call <a href="tel:8583846099" style="color:#b3841a;">858-384-6099</a> or reply <b style="color:#1a1813;">immediately</b> to reschedule and avoid any deposit loss.</div>
          </td>
        </tr>

        <!-- location -->
        <tr>
          <td style="padding:28px 50px 40px 50px;" class="px">
            <div style="height:1px; background-color:#d8d1bf; line-height:1px; font-size:0;">&nbsp;</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding-top:24px;">
              <tr>
                <td style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:15px; line-height:23px; color:#1a1813;">
                  <span style="font-size:10px; letter-spacing:2px; color:#8a8474; text-transform:uppercase;">The Studio</span><br />
                  <span style="display:inline-block; padding-top:8px;">8199 Clairemont Mesa Blvd, Suite L<br />San Diego, CA 92111</span><br />
                  <span style="color:#8a8474; font-size:13px;">Tuesday &ndash; Sunday &middot; Noon &ndash; 8 PM</span>
                </td>
                <td align="right" valign="bottom">
                  <a href="https://maps.google.com/?q=8199+Clairemont+Mesa+Blvd+Suite+L+San+Diego+CA+92111" style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:12px; letter-spacing:2px; color:#b3841a; text-transform:uppercase; font-weight:700;">Directions &rarr;</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- footer -->
        <tr>
          <td align="center" style="background-color:#1a1813; padding:30px 50px 32px 50px;" class="px">
            <div class="serif" style="font-family:'Shippori Mincho B1',serif; font-size:13px; letter-spacing:5px; color:#d9c79a; text-transform:uppercase;">Oyabun Tattoo</div>
            <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:11px; letter-spacing:3px; color:#857f72; text-transform:uppercase; padding-top:6px;">San Diego, California</div>
            <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:12px; line-height:20px; color:#9a9486; padding-top:16px;">
              <a href="tel:8583846099" style="color:#cfc8b6;">858-384-6099</a> &nbsp;&middot;&nbsp; <a href="&#109;&#97;&#105;&#108;&#116;&#111;&#58;&#99;&#111;&#110;&#116;&#97;&#99;&#116;&#64;&#111;&#121;&#97;&#98;&#117;&#110;&#116;&#97;&#116;&#116;&#111;&#111;&#46;&#99;&#111;&#109;" style="color:#cfc8b6;">&#99;&#111;&#110;&#116;&#97;&#99;&#116;&#64;&#111;&#121;&#97;&#98;&#117;&#110;&#116;&#97;&#116;&#116;&#111;&#111;&#46;&#99;&#111;&#109;</a>
            </div>
            <div style="font-family:'Helvetica Neue',Arial,sans-serif; font-size:11px; line-height:18px; color:#857f72; padding-top:14px;">
              <a href="https://oyabuntattoo.com" style="color:#9a9486;">Website</a> &nbsp;&middot;&nbsp; <a href="https://shop.oyabuntattoo.com" style="color:#9a9486;">Shop</a> &nbsp;&middot;&nbsp; <a href="https://oyabuntattoo.com/aftercare" style="color:#9a9486;">Aftercare</a> &nbsp;&middot;&nbsp; <a href="https://oyabuntattoo.com/faq" style="color:#9a9486;">FAQ</a>
            </div>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>
$$, true, false)
)
insert into public.operations_email_templates (
  template_key,
  subject,
  body_html,
  enabled,
  test_mode,
  updated_at
)
select
  template_key,
  subject,
  body_html,
  enabled,
  test_mode,
  now()
from zipped_templates
on conflict (template_key) do update
set
  subject = excluded.subject,
  body_html = excluded.body_html,
  enabled = excluded.enabled,
  test_mode = excluded.test_mode,
  updated_at = now();

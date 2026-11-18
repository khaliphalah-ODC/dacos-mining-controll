<script setup>
import { reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { workerApplicationSchema, registrationPrivacyVersion } from '@dacos/contracts'
const form=reactive({fullName:'',phone:'',employeeNumber:'',jobTitle:'',workArea:'UNDERGROUND',site:'',shift:'',emergencyContact:'',acknowledgement:false,privacyVersion:registrationPrivacyVersion,website:''})
const issues=ref({}),error=ref(''),busy=ref(false),submitted=ref(false)
async function submit(){
  error.value='';issues.value={}
  const result=workerApplicationSchema.safeParse(form)
  if(!result.success){for(const issue of result.error.issues)issues.value[issue.path[0]]=issue.message;return}
  busy.value=true
  try{
    const response=await fetch('/api/public/worker-applications',{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify(result.data)})
    const data=await response.json()
    if(!response.ok)throw new Error(response.status===429?data.error:'Unable to submit the application. Check your entries or try again later.')
    submitted.value=true
    // Clear personal information after success; no browser storage or public lookup.
    Object.assign(form,{fullName:'',phone:'',employeeNumber:'',jobTitle:'',site:'',shift:'',emergencyContact:'',acknowledgement:false})
  }catch(e){error.value=e.message}finally{busy.value=false}
}
</script>
<template>
  <main class="worker-registration">
    <div class="registration-brand"><RouterLink to="/welcome">DACOS</RouterLink><span>CONNECTED OPERATIONS & SAFETY</span></div>
    <section class="registration-card">
      <p class="registration-eyebrow">PERSONNEL APPLICATION</p><h1>Worker registration</h1>
      <p class="registration-intro">Submit your details for review by an authorized supervisor. Registration does not activate monitoring, assign a device or create a login account.</p>
      <div v-if="submitted" class="registration-success" role="status"><h2>Application received</h2><p>Your submission is pending review. Your supervisor will confirm the next steps. An existing identical pending application is treated as the same submission.</p><p>No worker information is available through this public page.</p><RouterLink to="/welcome">Return to DACOS →</RouterLink></div>
      <form v-else @submit.prevent="submit">
        <div class="registration-fields">
          <label v-for="[key,label,placeholder,max] in [['fullName','Full name','Your full name',100],['phone','Phone number','Include country code where possible',30],['employeeNumber','Employee number (optional)','If issued by your employer',50],['jobTitle','Job title','For example, electrician',100]]" :key="key">{{label}}<input v-model="form[key]" :type="key==='phone'?'tel':'text'" :name="key" :autocomplete="key==='fullName'?'name':key==='phone'?'tel':'off'" :placeholder="placeholder" :maxlength="max" :required="key!=='employeeNumber'" :aria-invalid="!!issues[key]" :aria-describedby="issues[key]?`error-${key}`:undefined"><small v-if="issues[key]" :id="`error-${key}`" class="field-error">{{issues[key]}}</small></label>
          <label>Work area<select v-model="form.workArea" name="workArea" required><option value="UNDERGROUND">Underground</option><option value="OUTDOOR">Outdoor</option><option value="BOTH">Both</option></select></label>
          <label>Mine / site<input v-model="form.site" name="site" required maxlength="100" placeholder="Mine or site name" :aria-invalid="!!issues.site" aria-describedby="error-site"><small v-if="issues.site" id="error-site" class="field-error">{{issues.site}}</small></label>
          <label>Shift<input v-model="form.shift" name="shift" required maxlength="100" placeholder="For example, day shift" :aria-invalid="!!issues.shift" aria-describedby="error-shift"><small v-if="issues.shift" id="error-shift" class="field-error">{{issues.shift}}</small></label>
          <label>Emergency contact (optional)<input v-model="form.emergencyContact" name="emergencyContact" maxlength="200" placeholder="Name, relationship and phone, if permitted"><small v-if="issues.emergencyContact" class="field-error">{{issues.emergencyContact}}</small></label>
        </div>
        <div class="registration-honeypot" aria-hidden="true"><label>Leave this field empty<input v-model="form.website" name="website" tabindex="-1" autocomplete="off"></label></div>
        <aside class="registration-privacy"><h2>Privacy & application review</h2><p>DACOS stores this application, your review decision and an audit record. Authorized administrators and supervisors can review your contact details for personnel registration and duplicate checks. Your application is not shown publicly.</p><p>Only include an emergency contact if you have permission to share their details. Contact your site supervisor to ask about correction, access or removal under the site's retention policy. Avoid submitting medical information or identification documents.</p><p>This is a development prototype. This form does not enroll you in location tracking or contact emergency responders.</p><label class="registration-consent"><input v-model="form.acknowledgement" type="checkbox" required aria-describedby="acknowledgement-error"><span>I have read the privacy notice, confirm these details are accurate, and acknowledge their use for application review.</span></label><small v-if="issues.acknowledgement" id="acknowledgement-error" class="field-error">{{issues.acknowledgement}}</small></aside>
        <p v-if="error" role="alert" class="field-error">{{error}}</p><p v-if="Object.keys(issues).length" role="alert" class="field-error">Please check the highlighted fields.</p>
        <button class="registration-submit" :disabled="busy">{{busy?'Submitting…':'Submit for review →'}}</button><p class="registration-footnote">Please submit once. Approval is a separate supervisor action.</p>
      </form>
    </section><p class="registration-footer">DACOS · Supervised demonstration prototype · <RouterLink to="/welcome">Public website</RouterLink></p>
  </main>
</template>
<style scoped>
.worker-registration{min-height:100vh;background:linear-gradient(140deg,#071b2e,#103d4a);color:#172f42;padding:40px 20px;font-family:Inter,Arial,sans-serif;color-scheme:light}.worker-registration *{box-sizing:border-box}.registration-brand{max-width:820px;margin:0 auto 24px;color:white;display:flex;align-items:center;gap:18px}.registration-brand a{font-size:27px;font-weight:800;letter-spacing:3px;color:#2bd0bf}.registration-brand span{font-size:9px;letter-spacing:1.5px}.registration-card{background:#fff;border-radius:12px;padding:40px;max-width:820px;margin:auto;box-shadow:0 20px 80px #0003}.registration-eyebrow{color:#00897e;font-size:10px;letter-spacing:2px;font-weight:700}.registration-card h1{font-size:32px;line-height:1.2;margin:12px 0}.registration-intro{color:#576d7d;font-size:14px;line-height:1.8;margin-bottom:28px}.registration-fields{display:grid;grid-template-columns:1fr 1fr;gap:20px}.registration-fields label{font-size:13px;font-weight:600}.registration-fields input,.registration-fields select{display:block;width:100%;margin-top:8px;background:#f8fafc;color:#172f42;border:1px solid #ccd9df;border-radius:6px;padding:12px;font:inherit;font-size:13px;min-height:46px}.worker-registration :focus-visible{outline:3px solid #008f84;outline-offset:3px}.registration-fields [aria-invalid=true]{border-color:#ba283a}.field-error{display:block;color:#a51b32;font-size:12px;margin-top:6px}.registration-privacy{background:#edf7f6;border:1px solid #cde6e2;border-radius:8px;padding:20px;margin-top:28px;font-size:12px;line-height:1.8}.registration-privacy h2,.registration-success h2{font-size:17px;font-weight:600}.registration-privacy p{margin:9px 0}.registration-consent{display:flex;gap:10px;align-items:flex-start;font-size:12px;margin-top:16px}.registration-consent input{margin-top:5px;width:18px;height:18px;flex-shrink:0;accent-color:#008f84}.registration-submit{width:100%;border:0;border-radius:6px;background:#008f84;color:#fff;font-size:14px;font-weight:600;padding:15px;cursor:pointer;margin-top:24px;min-height:48px}.registration-submit:disabled{opacity:.6}.registration-footnote{font-size:11px;color:#64748b;text-align:center;margin-top:12px}.registration-footer{color:#b4cbd5;font-size:11px;text-align:center;margin:22px 0}.registration-footer a{text-decoration:underline}.registration-success{background:#edf7f6;padding:24px;border-radius:8px;line-height:1.8}.registration-success p{margin:12px 0}.registration-success a{color:#007c73;text-decoration:underline}.registration-honeypot{position:absolute;left:-10000px;top:auto;width:1px;height:1px;overflow:hidden}@media(max-width:600px){.worker-registration{padding:24px 14px}.registration-card{padding:25px 20px}.registration-fields{grid-template-columns:1fr;gap:17px}.registration-brand{gap:12px}.registration-brand span{font-size:7px}.registration-card h1{font-size:27px}}
</style>

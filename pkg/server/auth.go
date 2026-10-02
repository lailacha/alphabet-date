package server

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"net/http"
	"os"
)

const cookieName = "ad_session"

// The app is shared by two people, so a single shared password is enough.
// The session cookie is a stateless HMAC of the password: changing
// APP_PASSWORD logs everybody out.
func password() string { return os.Getenv("APP_PASSWORD") }

// openAccess: without APP_PASSWORD the app is open, but only locally. On
// Vercel a missing password locks everything instead of exposing the photos.
func openAccess() bool { return password() == "" && os.Getenv("VERCEL") == "" }

// misconfigured: deployed without a password, nobody can log in.
func misconfigured() bool { return password() == "" && os.Getenv("VERCEL") != "" }

func sessionToken() string {
	secret := os.Getenv("SESSION_SECRET")
	if secret == "" {
		secret = "alphabet-date"
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(password()))
	return hex.EncodeToString(mac.Sum(nil))
}

func authenticated(r *http.Request) bool {
	if openAccess() {
		return true // no password configured (local dev)
	}
	if misconfigured() {
		return false
	}
	c, err := r.Cookie(cookieName)
	if err != nil {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(c.Value), []byte(sessionToken())) == 1
}

func checkPassword(p string) bool {
	return subtle.ConstantTimeCompare([]byte(p), []byte(password())) == 1
}

func setSession(w http.ResponseWriter, r *http.Request, value string, maxAge int) {
	http.SetCookie(w, &http.Cookie{
		Name:     cookieName,
		Value:    value,
		Path:     "/",
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https",
		SameSite: http.SameSiteLaxMode,
	})
}

// Package dbutil provides helpers for working with modernc.org/sqlite, which
// returns DATETIME (TEXT) columns as Go strings rather than time.Time values.
// Unlike mattn/go-sqlite3, the pure-Go modernc driver does not support _loc=UTC
// auto-parsing. These types implement sql.Scanner and driver.Valuer so that
// timestamp round-trips work transparently without changing any domain code.
package dbutil

import (
	"database/sql/driver"
	"fmt"
	"time"
)

// timeFormats lists the string formats that modernc.org/sqlite may use when
// serializing a time.Time value, plus common SQLite canonical formats.
// Formats are tried in order; the first match wins.
var timeFormats = []string{
	time.RFC3339Nano,                     // "2006-01-02T15:04:05.999999999Z07:00"
	time.RFC3339,                         // "2006-01-02T15:04:05Z07:00"
	"2006-01-02T15:04:05.999999999",      // without timezone, assume UTC
	"2006-01-02T15:04:05",               // without timezone, assume UTC
	"2006-01-02 15:04:05.999999999-07:00", // SQLite canonical with timezone
	"2006-01-02 15:04:05-07:00",          // SQLite canonical with timezone
	"2006-01-02 15:04:05.999999999",      // SQLite canonical, assume UTC
	"2006-01-02 15:04:05",               // SQLite canonical, assume UTC
}

func parseTimeStr(s string) (time.Time, error) {
	for _, f := range timeFormats {
		if t, err := time.Parse(f, s); err == nil {
			return t.UTC(), nil
		}
	}
	return time.Time{}, fmt.Errorf("dbutil: cannot parse timestamp %q", s)
}

// -----------------------------------------------------------------------
// Time — non-nullable DATETIME scanner
// -----------------------------------------------------------------------

// Time wraps time.Time and implements sql.Scanner so it can scan string values
// returned by modernc.org/sqlite for DATETIME columns.
//
// Usage in raw SQL scans:
//
//	var createdAt dbutil.Time
//	rows.Scan(..., &createdAt)
//	e.CreatedAt = createdAt.Time
//
// Usage in sqlc-generated params (driver.Valuer stores as RFC3339Nano string):
//
//	dbgen.InsertExerciseParams{CreatedAt: dbutil.TimeFrom(now), ...}
type Time struct {
	time.Time
}

// TimeFrom constructs a Time from a standard time.Time.
func TimeFrom(t time.Time) Time {
	return Time{t.UTC()}
}

// Scan implements sql.Scanner.
func (t *Time) Scan(src any) error {
	switch v := src.(type) {
	case time.Time:
		t.Time = v.UTC()
	case string:
		parsed, err := parseTimeStr(v)
		if err != nil {
			return err
		}
		t.Time = parsed
	case []byte:
		return t.Scan(string(v))
	default:
		return fmt.Errorf("dbutil.Time: unsupported source type %T", src)
	}
	return nil
}

// Value implements driver.Valuer so Time can be used as a query bind parameter.
// Stores as RFC3339Nano string so it can be parsed back by Scan.
func (t Time) Value() (driver.Value, error) {
	return t.Time.UTC().Format(time.RFC3339Nano), nil
}

// -----------------------------------------------------------------------
// NullableTime — nullable DATETIME scanner (mirrors sql.NullString pattern)
// -----------------------------------------------------------------------

// NullableTime is like Time but handles NULL columns. Valid is false when the
// database value was NULL. This replaces *time.Time in sqlc-generated code.
//
// Usage in raw SQL scans:
//
//	var startedAt dbutil.NullableTime
//	rows.Scan(..., &startedAt)
//	c.StartedAt = startedAt.ToTimePtr()
//
// Usage in sqlc-generated params:
//
//	dbgen.InsertCycleParams{StartedAt: dbutil.NullableTimeFromPtr(c.StartedAt), ...}
type NullableTime struct {
	Time  time.Time
	Valid bool // false when the database value is NULL
}

// NullableTimeFromPtr constructs a NullableTime from a *time.Time.
// If t is nil, Valid is false; otherwise Valid is true and Time is *t in UTC.
func NullableTimeFromPtr(t *time.Time) NullableTime {
	if t == nil {
		return NullableTime{Valid: false}
	}
	return NullableTime{Time: t.UTC(), Valid: true}
}

// ToTimePtr converts NullableTime back to *time.Time for domain structs.
// Returns nil when Valid is false.
func (t NullableTime) ToTimePtr() *time.Time {
	if !t.Valid {
		return nil
	}
	v := t.Time
	return &v
}

// Scan implements sql.Scanner.
func (t *NullableTime) Scan(src any) error {
	if src == nil {
		t.Valid = false
		t.Time = time.Time{}
		return nil
	}
	t.Valid = true
	switch v := src.(type) {
	case time.Time:
		t.Time = v.UTC()
	case string:
		parsed, err := parseTimeStr(v)
		if err != nil {
			return err
		}
		t.Time = parsed
	case []byte:
		return t.Scan(string(v))
	default:
		return fmt.Errorf("dbutil.NullableTime: unsupported source type %T", src)
	}
	return nil
}

// Value implements driver.Valuer.
func (t NullableTime) Value() (driver.Value, error) {
	if !t.Valid {
		return nil, nil
	}
	return t.Time.UTC().Format(time.RFC3339Nano), nil
}

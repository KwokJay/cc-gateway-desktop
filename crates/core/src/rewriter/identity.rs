use serde_json::Value;

use crate::config::IdentityConfig;

pub fn rewrite_messages_metadata(body: &mut Value, identity: &IdentityConfig) {
    let Some(metadata) = body.get_mut("metadata").and_then(Value::as_object_mut) else {
        return;
    };

    let Some(user_id) = metadata.get_mut("user_id") else {
        return;
    };

    let Some(user_id_str) = user_id.as_str() else {
        return;
    };

    let Ok(mut parsed) = serde_json::from_str::<Value>(user_id_str) else {
        return;
    };

    let Some(user_id_object) = parsed.as_object_mut() else {
        return;
    };

    user_id_object.insert(
        "device_id".to_string(),
        Value::String(identity.device_id.clone()),
    );

    user_id_object.insert(
        "account_uuid".to_string(),
        Value::String(identity.account_uuid.clone()),
    );

    user_id_object.insert(
        "session_id".to_string(),
        Value::String(identity.session_id.clone()),
    );

    *user_id = Value::String(parsed.to_string());
}

pub fn rewrite_event_identity(event_data: &mut Value, identity: &IdentityConfig) {
    let Some(object) = event_data.as_object_mut() else {
        return;
    };

    if object.contains_key("device_id") {
        object.insert(
            "device_id".to_string(),
            Value::String(identity.device_id.clone()),
        );
    }

    if object.contains_key("email") {
        object.insert("email".to_string(), Value::String(identity.email.clone()));
    }

    if object.contains_key("account_uuid") {
        object.insert(
            "account_uuid".to_string(),
            Value::String(identity.account_uuid.clone()),
        );
    }

    if object.contains_key("session_id") {
        object.insert(
            "session_id".to_string(),
            Value::String(identity.session_id.clone()),
        );
    }
}

pub fn rewrite_generic_identity(body: &mut Value, identity: &IdentityConfig) {
    rewrite_event_identity(body, identity);
}

pub fn rewrite_recursive_identity(value: &mut Value, identity: &IdentityConfig) {
    match value {
        Value::Object(object) => {
            if object.contains_key("device_id") {
                object.insert(
                    "device_id".to_string(),
                    Value::String(identity.device_id.clone()),
                );
            }

            if object.contains_key("email") {
                object.insert("email".to_string(), Value::String(identity.email.clone()));
            }

            if object.contains_key("account_uuid") {
                object.insert(
                    "account_uuid".to_string(),
                    Value::String(identity.account_uuid.clone()),
                );
            }

            if object.contains_key("session_id") {
                object.insert(
                    "session_id".to_string(),
                    Value::String(identity.session_id.clone()),
                );
            }

            for nested in object.values_mut() {
                rewrite_recursive_identity(nested, identity);
            }
        }
        Value::Array(items) => {
            for item in items {
                rewrite_recursive_identity(item, identity);
            }
        }
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn identity_config() -> IdentityConfig {
        IdentityConfig {
            device_id: "canonical_device_id_0123456789abcdef".to_string(),
            email: "canonical@example.com".to_string(),
            account_uuid: "canonical_account_uuid".to_string(),
            session_id: "canonical_session_id".to_string(),
        }
    }

    #[test]
    fn rewrites_metadata_user_id_all_identity_fields() {
        let identity = identity_config();
        let mut body = json!({
            "metadata": {
                "user_id": serde_json::to_string(&json!({
                    "device_id": "original_device_id",
                    "account_uuid": "acct-123",
                    "session_id": "sess-456"
                }))
                .unwrap()
            }
        });

        rewrite_messages_metadata(&mut body, &identity);

        let user_id =
            serde_json::from_str::<Value>(body["metadata"]["user_id"].as_str().unwrap()).unwrap();

        assert_eq!(user_id["device_id"], identity.device_id);
        assert_eq!(user_id["account_uuid"], identity.account_uuid);
        assert_eq!(user_id["session_id"], identity.session_id);
    }

    #[test]
    fn leaves_invalid_metadata_user_id_unchanged() {
        let identity = identity_config();
        let mut body = json!({
            "metadata": {
                "user_id": "not-json"
            }
        });

        rewrite_messages_metadata(&mut body, &identity);

        assert_eq!(body["metadata"]["user_id"], "not-json");
    }

    #[test]
    fn rewrites_event_identity_fields() {
        let identity = identity_config();
        let mut event_data = json!({
            "device_id": "real_device_id",
            "email": "real@example.com",
            "account_uuid": "acct-123",
            "session_id": "sess-456"
        });

        rewrite_event_identity(&mut event_data, &identity);

        assert_eq!(event_data["device_id"], identity.device_id);
        assert_eq!(event_data["email"], identity.email);
        assert_eq!(event_data["account_uuid"], identity.account_uuid);
        assert_eq!(event_data["session_id"], identity.session_id);
    }

    #[test]
    fn rewrites_generic_identity_payloads() {
        let identity = identity_config();
        let mut body = json!({
            "device_id": "real_device_id",
            "email": "real@example.com",
            "feature_flag": true
        });

        rewrite_generic_identity(&mut body, &identity);

        assert_eq!(body["device_id"], identity.device_id);
        assert_eq!(body["email"], identity.email);
        assert_eq!(body["feature_flag"], true);
    }

    #[test]
    fn rewrites_recursive_identity_fields() {
        let identity = identity_config();
        let mut metadata = json!({
            "user": {
                "device_id": "old_device",
                "email": "old@example.com",
                "account_uuid": "old-acct",
                "session_id": "old-sess"
            },
            "nested": {
                "deeper": {
                    "device_id": "nested-device",
                    "account_uuid": "nested-acct"
                }
            },
            "items": [
                { "session_id": "item-session" }
            ]
        });

        rewrite_recursive_identity(&mut metadata, &identity);

        assert_eq!(metadata["user"]["device_id"], identity.device_id);
        assert_eq!(metadata["user"]["email"], identity.email);
        assert_eq!(metadata["user"]["account_uuid"], identity.account_uuid);
        assert_eq!(metadata["user"]["session_id"], identity.session_id);
        assert_eq!(
            metadata["nested"]["deeper"]["device_id"],
            identity.device_id
        );
        assert_eq!(
            metadata["nested"]["deeper"]["account_uuid"],
            identity.account_uuid
        );
        assert_eq!(metadata["items"][0]["session_id"], identity.session_id);
    }
}

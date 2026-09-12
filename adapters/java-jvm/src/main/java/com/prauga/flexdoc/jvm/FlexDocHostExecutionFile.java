package com.prauga.flexdoc.jvm;

/** One browser-uploaded file part attached to a canonical host-execution form-data row. */
public record FlexDocHostExecutionFile(String name, String contentType, byte[] data) {
  /** Creates an immutable upload value with a safe fallback file name. */
  public FlexDocHostExecutionFile {
    name = name == null || name.isBlank() ? "upload.bin" : name;
    data = data == null ? new byte[0] : data.clone();
  }

  /** @return a defensive copy of the uploaded bytes */
  @Override
  public byte[] data() { return data.clone(); }
}
